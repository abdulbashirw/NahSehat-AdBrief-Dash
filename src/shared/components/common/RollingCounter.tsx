import { useEffect, useState } from "react";

function RollingDigit({ digit, delay }: { digit: string; delay: number }) {
  const [target, setTarget] = useState(0);

  useEffect(() => {
    const num = parseInt(digit, 10);
    if (!isNaN(num)) {
      const timer = setTimeout(() => setTarget(num), 50);
      return () => clearTimeout(timer);
    }
  }, [digit]);

  if (isNaN(parseInt(digit, 10))) {
    return <span className="inline-block">{digit}</span>;
  }

  return (
    <div className="relative inline-block h-[1em] overflow-hidden leading-none">
      <div
        className="flex flex-col transition-transform"
        style={{
          transform: `translateY(-${target * 10}%)`,
          transitionDuration: "2000ms",
          transitionTimingFunction: "cubic-bezier(0.34,1.56,0.64,1)",
          transitionDelay: `${delay}s`,
        }}
      >
        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
          <span key={num} className="flex h-[1em] items-center justify-center">
            {num}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function RollingCounter({ value }: { value: string | number }) {
  const digits = value.toString().split("");
  return (
    <div className="inline-flex items-center">
      {digits.map((digit, index) => (
        <RollingDigit key={`${index}-${digit}`} digit={digit} delay={index * 0.08} />
      ))}
    </div>
  );
}
