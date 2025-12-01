import React from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { 
  CheckCircle, 
  AlertTriangle, 
  FileText, 
  Calendar, 
  Building2, 
  DollarSign, 
  Package 
} from 'lucide-react';
import { ExtractionResult } from '../types';

interface DashboardProps {
  result: ExtractionResult;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

const formatCurrency = (val: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
const formatNumber = (val: number) => new Intl.NumberFormat('en-US').format(val);

const Dashboard: React.FC<DashboardProps> = ({ result }) => {
  const { 
    invoice_number, 
    invoice_date, 
    vendor_name, 
    po_breakdown,
    total_qty,
    total_value,
    validation,
    confidence_score,
    notes,
    other_charges_value
  } = result;

  // Calculate stats for charts
  const sortedByValue = [...po_breakdown].sort((a, b) => b.value - a.value);

  return (
    <div className="space-y-6 animate-fade-in">
      
      {/* Top Metadata Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-900 p-4 rounded-xl shadow-sm border border-slate-800 flex items-start space-x-3">
          <div className="p-2 bg-blue-900/30 text-blue-400 rounded-lg"><FileText size={20} /></div>
          <div>
            <p className="text-xs text-slate-400 font-medium uppercase">Invoice Number</p>
            <p className="text-lg font-bold text-slate-100 truncate">{invoice_number}</p>
          </div>
        </div>
        
        <div className="bg-slate-900 p-4 rounded-xl shadow-sm border border-slate-800 flex items-start space-x-3">
          <div className="p-2 bg-purple-900/30 text-purple-400 rounded-lg"><Calendar size={20} /></div>
          <div>
            <p className="text-xs text-slate-400 font-medium uppercase">Invoice Date</p>
            <p className="text-lg font-bold text-slate-100">{invoice_date}</p>
          </div>
        </div>

        <div className="bg-slate-900 p-4 rounded-xl shadow-sm border border-slate-800 flex items-start space-x-3">
          <div className="p-2 bg-green-900/30 text-green-400 rounded-lg"><Building2 size={20} /></div>
          <div className="overflow-hidden">
            <p className="text-xs text-slate-400 font-medium uppercase">Vendor</p>
            <p className="text-lg font-bold text-slate-100 truncate" title={vendor_name}>{vendor_name}</p>
          </div>
        </div>
      </div>

      {/* Validation & Totals Banner */}
      <div className={`rounded-xl border p-4 flex flex-col md:flex-row items-center justify-between gap-4
        ${validation.value_match && validation.qty_match 
          ? 'bg-emerald-950/30 border-emerald-900/50' 
          : 'bg-amber-950/30 border-amber-900/50'}
      `}>
        <div className="flex items-center gap-3">
          {validation.value_match && validation.qty_match ? (
             <div className="bg-emerald-900/50 p-2 rounded-full text-emerald-400">
               <CheckCircle size={24} />
             </div>
          ) : (
            <div className="bg-amber-900/50 p-2 rounded-full text-amber-400">
               <AlertTriangle size={24} />
             </div>
          )}
          <div>
            <h3 className={`font-bold ${validation.value_match ? 'text-emerald-400' : 'text-amber-400'}`}>
              {validation.value_match && validation.qty_match ? 'Validation Successful' : 'Validation Warning'}
            </h3>
            <p className="text-sm text-slate-300">
              {validation.value_match && validation.qty_match 
                ? 'Extracted totals match document totals perfectly.' 
                : `Variance detected: ${validation.details || 'Check individual lines.'}`
              }
            </p>
          </div>
        </div>

        <div className="flex gap-6 text-right">
          <div>
            <p className="text-xs text-slate-400 uppercase font-semibold">Total Pairs</p>
            <p className="text-xl font-bold text-slate-100">{formatNumber(total_qty)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400 uppercase font-semibold">Total Value</p>
            <p className="text-xl font-bold text-slate-100">{formatCurrency(total_value)}</p>
          </div>
        </div>
      </div>

      {/* Charts Section - Now stacked vertically (Rows) */}
      <div className="flex flex-col gap-6">
        
        {/* Main Table - Row 1 (Made Bigger) */}
        <div className="bg-slate-900 rounded-xl shadow-sm border border-slate-800 overflow-hidden flex flex-col">
          <div className="px-6 py-4 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
            <h3 className="font-semibold text-slate-200">Purchase Order Breakdown</h3>
            <span className={`px-2 py-1 text-xs rounded-full font-medium ${
              confidence_score === 'HIGH' ? 'bg-blue-900/50 text-blue-300' : 
              confidence_score === 'MEDIUM' ? 'bg-yellow-900/50 text-yellow-300' : 'bg-red-900/50 text-red-300'
            }`}>
              {confidence_score} Confidence
            </span>
          </div>
          {/* Increased max-height from 400px to 600px */}
          <div className="overflow-x-auto overflow-y-auto max-h-[600px] custom-scrollbar">
            <table className="w-full text-left text-sm relative">
              <thead className="sticky top-0 z-10">
                <tr className="border-b border-slate-800 text-slate-400 bg-slate-900 shadow-sm">
                  <th className="px-6 py-3 font-medium">PO Number</th>
                  <th className="px-6 py-3 font-medium text-right">Quantity (Pairs)</th>
                  <th className="px-6 py-3 font-medium text-right">Value (USD)</th>
                  <th className="px-6 py-3 font-medium text-right">% of Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {po_breakdown.map((po, idx) => (
                  <tr key={idx} className="hover:bg-slate-800 transition-colors">
                    <td className="px-6 py-3 font-medium text-slate-300">{po.po_number}</td>
                    <td className="px-6 py-3 text-right text-slate-400">{formatNumber(po.qty)}</td>
                    <td className="px-6 py-3 text-right text-slate-300 font-mono">{formatCurrency(po.value)}</td>
                    <td className="px-6 py-3 text-right text-slate-500">
                      {((po.value / total_value) * 100).toFixed(1)}%
                    </td>
                  </tr>
                ))}
                {/* Summary Row for Other Charges if present */}
                {other_charges_value && other_charges_value !== 0 && (
                   <tr className="bg-slate-900/30 italic">
                    <td className="px-6 py-3 font-medium text-slate-500">Other Charges (Freight, etc.)</td>
                    <td className="px-6 py-3 text-right text-slate-600">-</td>
                    <td className="px-6 py-3 text-right text-slate-400 font-mono">{formatCurrency(other_charges_value)}</td>
                    <td className="px-6 py-3 text-right text-slate-600">
                      {((other_charges_value / total_value) * 100).toFixed(1)}%
                    </td>
                   </tr>
                )}
                <tr className="bg-slate-900 font-bold border-t border-slate-700">
                  <td className="px-6 py-3 text-slate-100">TOTAL</td>
                  <td className="px-6 py-3 text-right text-slate-100">
                    {formatNumber(po_breakdown.reduce((sum, item) => sum + item.qty, 0))}
                  </td>
                  <td className="px-6 py-3 text-right text-slate-100 font-mono">
                    {formatCurrency(po_breakdown.reduce((sum, item) => sum + item.value, 0) + (other_charges_value || 0))}
                  </td>
                  <td className="px-6 py-3 text-right text-slate-400">100%</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Visualizations - Row 2 (Made Smaller) */}
        <div className="bg-slate-900 rounded-xl shadow-sm border border-slate-800 p-4 flex flex-col">
          <h3 className="font-semibold text-slate-200 mb-4">Value Distribution</h3>
          <div className="flex-1 w-full flex flex-col lg:flex-row items-center gap-6">
            <div className="flex-1 w-full h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={sortedByValue}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={5}
                    dataKey="value"
                    stroke="none"
                  >
                    {sortedByValue.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value: number) => formatCurrency(value)}
                    contentStyle={{ 
                      borderRadius: '8px', 
                      border: '1px solid #334155', 
                      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.5)',
                      backgroundColor: '#1e293b',
                      color: '#f1f5f9'
                    }}
                    itemStyle={{ color: '#e2e8f0' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            
            <div className="flex-1 w-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-1 gap-2 max-h-[250px] overflow-y-auto custom-scrollbar pr-2">
              {sortedByValue.map((entry, index) => (
                <div key={index} className="flex items-center justify-between text-sm p-2 hover:bg-slate-800/50 rounded-lg transition-colors">
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                    <span className="text-slate-300 truncate font-medium" title={entry.po_number}>{entry.po_number}</span>
                  </div>
                  <span className="font-medium text-slate-400 font-mono ml-4">{formatCurrency(entry.value)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Notes & Raw Data Toggle */}
      {notes && (
        <div className="bg-blue-900/20 border border-blue-900/50 rounded-xl p-4 text-sm text-blue-200 flex items-start gap-3">
          <div className="shrink-0 mt-0.5"><FileText size={16} /></div>
          <p>{notes}</p>
        </div>
      )}

      <details className="group bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
        <summary className="cursor-pointer p-4 font-medium text-slate-400 hover:bg-slate-800 transition-colors flex items-center justify-between">
          <span>View Raw JSON Response</span>
          <span className="text-xs bg-slate-800 px-2 py-1 rounded group-open:bg-slate-700 text-slate-300">Expand</span>
        </summary>
        <div className="p-4 bg-slate-950 text-slate-400 overflow-auto max-h-96 custom-scrollbar text-xs font-mono border-t border-slate-800">
          <pre>{JSON.stringify(result, null, 2)}</pre>
        </div>
      </details>
    </div>
  );
};

export default Dashboard;