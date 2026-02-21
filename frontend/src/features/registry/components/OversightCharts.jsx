import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';

const COLORS = ['#1a3aa3', '#0891b2', '#059669', '#d97706', '#dc2626', '#7c3aed', '#db2777'];

const SANCTION_LABELS = {
  imposed: 'Επιβληθείσα',
  paid: 'Εξοφληθείσα',
  appealed: 'Σε ένσταση',
  cancelled: 'Ακυρωθείσα',
};

const MONTH_LABELS = {
  '01': 'Ιαν', '02': 'Φεβ', '03': 'Μαρ', '04': 'Απρ',
  '05': 'Μαΐ', '06': 'Ιουν', '07': 'Ιουλ', '08': 'Αυγ',
  '09': 'Σεπ', '10': 'Οκτ', '11': 'Νοε', '12': 'Δεκ',
};

function formatMonth(val) {
  const parts = val.split('-');
  return MONTH_LABELS[parts[1]] || parts[1];
}

export default function OversightCharts({
  inspectionsByMonth = [],
  structuresByType = [],
  sanctionsByStatus = [],
}) {
  const monthData = inspectionsByMonth.map((d) => ({
    ...d,
    label: formatMonth(d.month),
  }));

  const sanctionData = sanctionsByStatus.map((d) => ({
    ...d,
    name: SANCTION_LABELS[d.status] || d.status,
  }));

  return (
    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
      {/* Inspections per month — Bar chart */}
      <Card className="border-[#e8e2d8] md:col-span-2 lg:col-span-1">
        <CardHeader className="pb-2">
          <CardTitle className="text-base text-[#2a2520]">Έλεγχοι ανά μήνα</CardTitle>
        </CardHeader>
        <CardContent>
          {monthData.length === 0 ? (
            <p className="text-sm text-[#8a8580] text-center py-8">Δεν υπάρχουν δεδομένα.</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={monthData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e8e2d8" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#8a8580' }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#8a8580' }} />
                <Tooltip
                  contentStyle={{ border: '1px solid #e8e2d8', borderRadius: 8, fontSize: 13 }}
                  labelFormatter={(_, payload) => payload?.[0]?.payload?.month || ''}
                />
                <Bar dataKey="count" fill="#1a3aa3" radius={[4, 4, 0, 0]} name="Έλεγχοι" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Structures by type — Pie chart */}
      <Card className="border-[#e8e2d8]">
        <CardHeader className="pb-2">
          <CardTitle className="text-base text-[#2a2520]">Δομές ανά τύπο</CardTitle>
        </CardHeader>
        <CardContent>
          {structuresByType.length === 0 ? (
            <p className="text-sm text-[#8a8580] text-center py-8">Δεν υπάρχουν δεδομένα.</p>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie
                    data={structuresByType}
                    dataKey="count"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={75}
                  >
                    {structuresByType.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ border: '1px solid #e8e2d8', borderRadius: 8, fontSize: 13 }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="max-h-[140px] overflow-y-auto mt-2 space-y-1">
                {structuresByType.map((item, i) => {
                  const total = structuresByType.reduce((s, d) => s + d.count, 0);
                  const pct = total > 0 ? ((item.count / total) * 100).toFixed(0) : 0;
                  return (
                    <div key={i} className="flex items-start gap-2 text-[11px] leading-[16px]">
                      <span
                        className="inline-block w-2.5 h-2.5 rounded-sm flex-shrink-0 mt-[2px]"
                        style={{ backgroundColor: COLORS[i % COLORS.length] }}
                      />
                      <span className="text-[#5a5550]">{item.name} ({pct}%)</span>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Sanctions by status — Pie chart */}
      <Card className="border-[#e8e2d8]">
        <CardHeader className="pb-2">
          <CardTitle className="text-base text-[#2a2520]">Κυρώσεις ανά κατάσταση</CardTitle>
        </CardHeader>
        <CardContent>
          {sanctionData.length === 0 ? (
            <p className="text-sm text-[#8a8580] text-center py-8">Δεν υπάρχουν δεδομένα.</p>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie
                    data={sanctionData}
                    dataKey="count"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={75}
                  >
                    <Cell fill="#dc2626" />
                    <Cell fill="#059669" />
                    <Cell fill="#d97706" />
                    <Cell fill="#9ca3af" />
                  </Pie>
                  <Tooltip
                    contentStyle={{ border: '1px solid #e8e2d8', borderRadius: 8, fontSize: 13 }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-2 space-y-1">
                {sanctionData.map((item, i) => {
                  const colors = ['#dc2626', '#059669', '#d97706', '#9ca3af'];
                  return (
                    <div key={i} className="flex items-center gap-2 text-[11px] leading-[16px]">
                      <span
                        className="inline-block w-2.5 h-2.5 rounded-sm flex-shrink-0"
                        style={{ backgroundColor: colors[i] || '#9ca3af' }}
                      />
                      <span className="text-[#5a5550]">{item.name}: {item.count}</span>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
