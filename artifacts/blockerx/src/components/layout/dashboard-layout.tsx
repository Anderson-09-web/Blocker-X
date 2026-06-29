import React from "react";
import Sidebar from "./sidebar";
import { motion } from "framer-motion";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto overflow-x-hidden relative">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="p-8 max-w-7xl mx-auto h-full"
        >
          {children}
        </motion.div>
      </main>
    </div>
  );
}
