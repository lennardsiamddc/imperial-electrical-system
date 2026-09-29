import './globals.css';
import type {Metadata} from 'next';
export const metadata:Metadata={title:'Imperial Electrical | Business Management',description:'Imperial Electrical Business Management System'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>;}
