import {query,closeDB} from '../lib/db';
query("SELECT id,sku,name,brand,category,primary_uom,secondary_uom,base_price,retail_price,contractor_price,meter_price,pricing_rules,selling_prices FROM products ORDER BY name").then(r=>console.log(JSON.stringify(r.rows,null,2))).finally(closeDB);
