// LiquidGlassBox.jsx
import { Box } from "@chakra-ui/react";
import { useEffect, useRef } from "react";

export default function LiquidGlassBoxStatic(props) {
  const ref = useRef(null);

  // ---- Dynamic tint ---------------------------------
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const updateTint = () => {
      const bodyBg = getComputedStyle(document.body).backgroundColor; // e.g. rgb(15,23,42)
      const rgb = bodyBg.match(/\d+/g)?.slice(0, 3).join(",") || "255,255,255";
      el.style.setProperty("--glass-tint", rgb);
    };

    updateTint();
    window.addEventListener("scroll", updateTint, { passive: true });
    window.addEventListener("resize", updateTint);
    return () => {
      window.removeEventListener("scroll", updateTint);
      window.removeEventListener("resize", updateTint);
    };
  }, []);

  return (
    <Box
      ref={ref}
      className="liquid-glass-static"
      {...props}
    />
  );
}
