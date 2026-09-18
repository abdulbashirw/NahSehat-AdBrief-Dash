import { useEffect, useState } from "react";
import PeriodFilter from "@/features/indemnity-overview/components/PeriodFilter";
import ExportButton from "@/shared/components/common/ExportButton";

interface FilterBoardHeaderProps {
  title: string;
  subtitle: string;
  isFetching: boolean;
  exportEnabled: boolean;
  filename: string;
  getPayload: () => { headers: string[]; rows: (string | number)[][] };
}

export default function FilterBoardHeader({
  title,
  subtitle,
  isFetching,
  exportEnabled,
  filename,
  getPayload,
}: FilterBoardHeaderProps) {
  const [liveClock, setLiveClock] = useState("");

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const hh = String(now.getHours()).padStart(2, "0");
      const min = String(now.getMinutes()).padStart(2, "0");
      const ss = String(now.getSeconds()).padStart(2, "0");
      setLiveClock(`${hh}:${min}:${ss}`);
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="flex shrink-0 flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div>
        <h1 className="font-display text-[24px] font-extrabold text-[#1F2A37] md:text-[28px]">{title}</h1>
        <p className="mt-0.5 text-[13px] italic text-[#9CA3AF]">{subtitle}</p>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-3">
        <PeriodFilter isFetching={isFetching} liveClock={liveClock} />
        {exportEnabled && (
          <>
            <div className="hidden w-px self-stretch bg-[#E5E8EC] md:block" />
            <ExportButton filename={filename} getPayload={getPayload} />
          </>
        )}
      </div>
    </div>
  );
}
