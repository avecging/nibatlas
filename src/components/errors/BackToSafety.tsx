"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import styles from "./OffTheMap.module.css";

export function BackToSafety() {
  const router = useRouter();
  const [canReturn, setCanReturn] = useState(false);

  useEffect(() => {
    // History length alone is insufficient (a visitor may have come from
    // another website). Use a safe in-app referrer; otherwise go home.
    try {
      const referrer = document.referrer ? new URL(document.referrer) : null;
      setCanReturn(Boolean(referrer && referrer.origin === window.location.origin && window.history.length > 1));
    } catch {
      setCanReturn(false);
    }
  }, []);

  return (
    <button className={styles.back} type="button" onClick={() => canReturn ? router.back() : router.push("/")}>
      <span aria-hidden="true">←</span>
      {canReturn ? "Go back" : "Back to the map"}
    </button>
  );
}
