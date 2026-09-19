import './globals.css';
import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'diTrinity IRMS', description: 'Internal Resource Management System' };
export default function RootLayout({children}:{children:React.ReactNode}) { return <html lang="en"><body>{children}</body></html>; }
