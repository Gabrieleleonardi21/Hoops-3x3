import { useEffect } from "react";

/** Blocca lo scroll del body mentre il componente è montato (es. quando una modale è aperta) */
export function useScrollLock() {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);
}
