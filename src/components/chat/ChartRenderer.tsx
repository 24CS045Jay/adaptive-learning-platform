import { useMemo } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Cell,
} from "recharts";
import { BarChart3, LineChart as LineChartIcon, PieChart, AlertCircle, Info } from "lucide-react";

export interface ChartSpec {
  type?: string;
  chartType?: "bar" | "line" | "scatter" | "area";
  title?: string;
  xLabel?: string;
  yLabel?: string;
  data: Array<Record<string, any>>;
  explanation?: string;
}

const PALETTE = ["#7c3aed", "#3b82f6", "#10b981", "#f59e0b", "#ec4899", "#06b6d4"];

export function ChartRenderer({
  spec,
  className = "",
}: {
  spec: ChartSpec;
  className?: string;
}) {
  const { isValid, chartType, dataKeyX, numericKeys, sanitizedData, error } = useMemo(() => {
    if (!spec || !Array.isArray(spec.data) || spec.data.length === 0) {
      return { isValid: false, error: "No chart data points provided." };
    }

    const firstItem = spec.data[0];
    if (typeof firstItem !== "object" || firstItem === null) {
      return { isValid: false, error: "Invalid data format." };
    }

    // Determine X axis key (first non-numeric key or 'name'/'label'/'x'/'category')
    const keys = Object.keys(firstItem);
    const candidateX =
      keys.find((k) => ["label", "name", "category", "x", "date", "year", "term"].includes(k.toLowerCase())) ||
      keys.find((k) => typeof firstItem[k] === "string") ||
      keys[0];

    // Determine numeric keys (values to plot)
    const numKeys = keys.filter(
      (k) => k !== candidateX && typeof Number(firstItem[k]) === "number" && !isNaN(Number(firstItem[k]))
    );

    // If no explicit numeric key found besides X, check if X itself has numeric companions or fallback to single key 'value'/'y'
    const finalNumKeys = numKeys.length > 0 ? numKeys : keys.filter((k) => k !== candidateX);

    if (finalNumKeys.length === 0) {
      return { isValid: false, error: "No numerical values to plot." };
    }

    // Sanitize data values to ensure numbers are numbers
    const cleanData = spec.data.map((item) => {
      const row: Record<string, any> = { ...item };
      finalNumKeys.forEach((k) => {
        const val = Number(row[k]);
        row[k] = isNaN(val) ? 0 : val;
      });
      return row;
    });

    const type = (spec.chartType || "bar").toLowerCase();
    const resolvedType = ["line", "scatter", "area", "bar"].includes(type) ? type : "bar";

    return {
      isValid: true,
      chartType: resolvedType,
      dataKeyX: candidateX,
      numericKeys: finalNumKeys,
      sanitizedData: cleanData,
      error: null,
    };
  }, [spec]);

  if (!isValid || !sanitizedData) {
    return (
      <div className="my-3 rounded-xl border border-border bg-muted/30 p-4 text-xs text-muted-foreground space-y-2">
        <div className="flex items-center gap-2 text-amber-500 font-medium">
          <AlertCircle className="h-4 w-4" />
          <span>Chart visualization unavailable</span>
        </div>
        {spec?.explanation && <p className="text-foreground text-sm">{spec.explanation}</p>}
        {error && <span className="opacity-70 font-mono text-[11px]">({error})</span>}
      </div>
    );
  }

  return (
    <div
      className={`my-4 overflow-hidden rounded-2xl border border-violet/25 bg-card/90 p-4 sm:p-5 shadow-sm backdrop-blur-sm space-y-3 ${className}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 pb-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet/10 text-violet">
            {chartType === "line" ? (
              <LineChartIcon className="h-4 w-4" />
            ) : chartType === "area" ? (
              <PieChart className="h-4 w-4" />
            ) : (
              <BarChart3 className="h-4 w-4" />
            )}
          </div>
          <div>
            <h4 className="text-sm font-semibold text-foreground">
              {spec.title || "Interactive Concept Visualization"}
            </h4>
            {spec.yLabel && (
              <p className="text-[11px] text-muted-foreground font-mono">
                {spec.yLabel} {spec.xLabel ? `vs ${spec.xLabel}` : ""}
              </p>
            )}
          </div>
        </div>
        <span className="rounded-full bg-violet/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-violet">
          {chartType} chart
        </span>
      </div>

      <div className="h-60 sm:h-72 w-full pt-2">
        <ResponsiveContainer width="100%" height="100%">
          {chartType === "line" ? (
            <LineChart data={sanitizedData} margin={{ top: 10, right: 20, left: -10, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.25} />
              <XAxis
                dataKey={dataKeyX}
                tick={{ fontSize: 11, fill: "#94a3b8" }}
                angle={sanitizedData.length > 5 ? -20 : 0}
                textAnchor={sanitizedData.length > 5 ? "end" : "middle"}
              />
              <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#0f172a",
                  borderColor: "#7c3aed",
                  borderRadius: "10px",
                  fontSize: "12px",
                  color: "#fff",
                }}
              />
              {numericKeys.length > 1 && <Legend wrapperStyle={{ fontSize: 11, paddingTop: 10 }} />}
              {numericKeys.map((k, idx) => (
                <Line
                  key={k}
                  type="monotone"
                  dataKey={k}
                  stroke={PALETTE[idx % PALETTE.length]}
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: PALETTE[idx % PALETTE.length] }}
                  activeDot={{ r: 6 }}
                />
              ))}
            </LineChart>
          ) : chartType === "area" ? (
            <AreaChart data={sanitizedData} margin={{ top: 10, right: 20, left: -10, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.25} />
              <XAxis dataKey={dataKeyX} tick={{ fontSize: 11, fill: "#94a3b8" }} />
              <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#0f172a",
                  borderColor: "#7c3aed",
                  borderRadius: "10px",
                  fontSize: "12px",
                  color: "#fff",
                }}
              />
              {numericKeys.length > 1 && <Legend wrapperStyle={{ fontSize: 11 }} />}
              {numericKeys.map((k, idx) => (
                <Area
                  key={k}
                  type="monotone"
                  dataKey={k}
                  stroke={PALETTE[idx % PALETTE.length]}
                  fill={PALETTE[idx % PALETTE.length]}
                  fillOpacity={0.2}
                />
              ))}
            </AreaChart>
          ) : chartType === "scatter" ? (
            <ScatterChart margin={{ top: 10, right: 20, left: -10, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.25} />
              <XAxis dataKey={dataKeyX} tick={{ fontSize: 11, fill: "#94a3b8" }} />
              <YAxis dataKey={numericKeys[0]} tick={{ fontSize: 11, fill: "#94a3b8" }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#0f172a",
                  borderColor: "#7c3aed",
                  borderRadius: "10px",
                  fontSize: "12px",
                  color: "#fff",
                }}
              />
              <Scatter name={spec.title || "Data"} data={sanitizedData} fill="#7c3aed" />
            </ScatterChart>
          ) : (
            <BarChart data={sanitizedData} margin={{ top: 10, right: 20, left: -10, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.25} />
              <XAxis
                dataKey={dataKeyX}
                tick={{ fontSize: 11, fill: "#94a3b8" }}
                angle={sanitizedData.length > 5 ? -25 : 0}
                textAnchor={sanitizedData.length > 5 ? "end" : "middle"}
              />
              <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#0f172a",
                  borderColor: "#7c3aed",
                  borderRadius: "10px",
                  fontSize: "12px",
                  color: "#fff",
                }}
              />
              {numericKeys.length > 1 && <Legend wrapperStyle={{ fontSize: 11 }} />}
              {numericKeys.map((k, idx) => (
                <Bar key={k} dataKey={k} radius={[6, 6, 0, 0]}>
                  {sanitizedData.map((_, i) => (
                    <Cell
                      key={`cell-${i}`}
                      fill={numericKeys.length === 1 ? PALETTE[i % PALETTE.length] : PALETTE[idx % PALETTE.length]}
                    />
                  ))}
                </Bar>
              ))}
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>

      {spec.explanation && (
        <div className="flex items-start gap-2 rounded-xl bg-violet/5 border border-violet/10 p-3 text-xs text-foreground/90 leading-relaxed">
          <Info className="h-4 w-4 shrink-0 text-violet mt-0.5" />
          <span>{spec.explanation}</span>
        </div>
      )}
    </div>
  );
}
