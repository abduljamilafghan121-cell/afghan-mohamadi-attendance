import { Suspense } from "react";
import AddVisitClient from "./AddVisitClient";

export default function Page() {
  return (
    <Suspense fallback={<div className="p-4 text-sm">Loading...</div>}>
      <AddVisitClient />
    </Suspense>
  );
}
