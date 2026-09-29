'use client';
export default function ErrorPage({reset}:{reset:()=>void}){return <div className="panel" style={{margin:32}}><h1>Unable to load this page</h1><p>Please try again. If this is your first run, complete the database setup in the README.</p><button onClick={reset}>Try again</button></div>;}
