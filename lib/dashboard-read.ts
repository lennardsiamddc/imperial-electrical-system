// Read-only dashboard projections. No transaction or master-data mutation.
import {transaction} from './db';
import {freshActor} from './masters';
import {allows,type Actor} from './permissions';
export async function dashboardData(actor:Actor,period='month'){return transaction(async db=>{
 actor=await freshActor(db,actor.id);
 const sales=allows(actor,'sales.read'),prices=sales&&allows(actor,'sales.prices'),profit=prices&&allows(actor,'sales.profit');
 const inventory=allows(actor,'inventory.read'),value=inventory&&allows(actor,'inventory.value'),customers=allows(actor,'customers.read');
 const visible=customers?'TRUE':'s.customer_id IS NULL';
 const today="(CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Manila')::date";
 const date="(s.occurred_at AT TIME ZONE 'Asia/Manila')::date";
 const since=period==='year'?`date_trunc('year',${today})`:`date_trunc('month',${today})`;
 const totals=prices?(await db.query(`SELECT COALESCE(sum(s.gross_total) FILTER(WHERE ${date}=${today}),0)::text AS today,COALESCE(sum(s.gross_total) FILTER(WHERE ${date}>=date_trunc('month',${today}) AND ${date}<=${today}),0)::text AS month FROM sales s WHERE s.status='Posted' AND ${visible}`)).rows[0]:null;
 const chart=prices?(await db.query(`SELECT to_char(${date},'${period==='year'?'YYYY-MM':'YYYY-MM-DD'}') AS bucket,sum(s.gross_total)::text AS sales${profit?',sum(s.profit)::text AS profit':''} FROM sales s WHERE s.status='Posted' AND ${visible} AND ${date}>=${since} AND ${date}<=${today} GROUP BY bucket ORDER BY bucket`)).rows:[];
 const top=sales?(await db.query(`SELECT l.product_id,l.product_name,l.uom,sum(l.quantity)::text AS quantity FROM sale_lines l JOIN sales s ON s.id=l.sale_id WHERE l.active AND s.status='Posted' AND ${visible} AND ${date}>=${since} AND ${date}<=${today} GROUP BY l.product_id,l.product_name,l.uom ORDER BY sum(l.quantity) DESC,l.product_name LIMIT 5`)).rows:[];
 const inventoryValue=value?(await db.query("SELECT COALESCE(sum(CASE WHEN kind='IN' THEN total_cost ELSE -total_cost END),0)::text AS value FROM inventory_movements")).rows[0].value:null;
 const customerCount=customers?(await db.query('SELECT count(*)::text AS count FROM customers')).rows[0].count:null;
 return {totals,chart,top,inventoryValue,customerCount,access:{sales,prices,profit,inventory,value,customers}};
});}
