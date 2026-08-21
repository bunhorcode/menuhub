import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
})

export const metadata: Metadata = {
  title: "MenuHub | Slate & Emerald Digital Menu",
  description: "High-definition digital menu platform built with Next.js 16 and Supabase.",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-[#f8f9ff] text-[#0d1c2d]">
        {children}
      </body>
    </html>
  )
}
