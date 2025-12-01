import { GoogleGenAI, Type, Schema } from "@google/genai";
import { ExtractionResult } from "../types";
import { SYSTEM_INSTRUCTION } from "../constants";
// @ts-ignore
import { read, utils } from "xlsx";

export const extractInvoiceData = async (
  file: File,
  apiKey: string
): Promise<ExtractionResult> => {
  if (!apiKey) {
    throw new Error("API Key is required");
  }

  const ai = new GoogleGenAI({ apiKey });
  let contentPart: any;

  // Handle Excel/CSV files by converting to text
  if (
    file.type.includes("sheet") || 
    file.type.includes("excel") || 
    file.type.includes("csv") ||
    file.name.endsWith(".xlsx") ||
    file.name.endsWith(".xls") ||
    file.name.endsWith(".csv")
  ) {
    const arrayBuffer = await file.arrayBuffer();
    let csvContent = "";

    if (file.type === "text/csv" || file.name.endsWith(".csv")) {
      const textDecoder = new TextDecoder();
      csvContent = textDecoder.decode(arrayBuffer);
    } else {
      try {
        const workbook = read(arrayBuffer, { type: 'array' });
        // Use the first sheet
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        csvContent = utils.sheet_to_csv(worksheet);
      } catch (e) {
        console.error("Excel parsing error", e);
        throw new Error("Failed to parse Excel file. Please ensure it is a valid format.");
      }
    }
    
    // Pass as text to the model
    contentPart = { text: `DOCUMENT CONTENT (Tabular Data):\n${csvContent}` };
  } else {
    // Handle Image / PDF (Standard multimodal inputs)
    const base64Data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        const base64 = result.split(",")[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

    contentPart = { inlineData: { mimeType: file.type, data: base64Data } };
  }

  // Define the output schema strictly
  const responseSchema: Schema = {
    type: Type.OBJECT,
    properties: {
      invoice_number: { type: Type.STRING, description: "The invoice number found on the document." },
      invoice_date: { type: Type.STRING, description: "The date of the invoice (YYYY-MM-DD or original format)." },
      vendor_name: { type: Type.STRING, description: "The name of the vendor or supplier." },
      document_format: { 
        type: Type.STRING, 
        enum: ["Type A", "Type B", "Type C", "Unknown"],
        description: "The structural format of the invoice."
      },
      po_breakdown: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            po_number: { type: Type.STRING },
            qty: { type: Type.INTEGER, description: "Total quantity (pairs/units) for this PO." },
            value: { type: Type.NUMBER, description: "Total value in USD for this PO." }
          },
          required: ["po_number", "qty", "value"]
        },
        description: "List of aggregated totals per Purchase Order."
      },
      total_qty: { type: Type.INTEGER, description: "The total quantity explicitly stated on the document footer." },
      total_value: { type: Type.NUMBER, description: "The total invoice value explicitly stated on the document." },
      validation: {
        type: Type.OBJECT,
        properties: {
          qty_match: { type: Type.BOOLEAN, description: "True if sum of PO quantities equals document total." },
          value_match: { type: Type.BOOLEAN, description: "True if sum of PO values equals document total." },
          qty_variance: { type: Type.INTEGER, description: "Difference between extracted sum and document total." },
          value_variance: { type: Type.NUMBER, description: "Difference between extracted sum and document total." },
          details: { type: Type.STRING, description: "Explanation of any variance found." }
        },
        required: ["qty_match", "value_match", "qty_variance", "value_variance"]
      },
      confidence_score: { 
        type: Type.STRING, 
        enum: ["HIGH", "MEDIUM", "LOW"],
        description: "AI confidence in the extraction accuracy." 
      },
      notes: { type: Type.STRING, description: "Any general notes, warnings about ambiguity, or missing fields." },
      other_charges_value: { type: Type.NUMBER, description: "Sum of non-product charges like freight or handling." }
    },
    required: [
      "invoice_number", 
      "invoice_date", 
      "vendor_name", 
      "document_format", 
      "po_breakdown", 
      "total_qty", 
      "total_value", 
      "validation",
      "confidence_score"
    ]
  };

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: {
        parts: [
          contentPart,
          { text: "Analyze this commercial invoice and extract the PO summary data." }
        ]
      },
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: responseSchema,
        temperature: 0.1, // Low temperature for high precision
      },
    });

    const text = response.text;
    if (!text) {
        throw new Error("No response text from Gemini");
    }
    
    return JSON.parse(text) as ExtractionResult;
  } catch (error) {
    console.error("Gemini Extraction Error:", error);
    throw error;
  }
};