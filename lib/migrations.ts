import {readFile} from 'node:fs/promises';
import {transaction} from './db';
export async function migrate(){
 await transaction(async db=>{
  await db.query('CREATE SCHEMA IF NOT EXISTS imperial');
  await db.query('CREATE TABLE IF NOT EXISTS imperial.schema_migrations (version text PRIMARY KEY, applied_at timestamptz DEFAULT now())');
  await db.query('LOCK TABLE imperial.schema_migrations IN EXCLUSIVE MODE');
  for(const [version,file] of [['001','001_stage1.sql'],['002','002_employee_access.sql'],['003','003_inventory.sql'],['004','004_vat_foundation.sql'],['005','005_sales.sql'],['006','006_returns.sql'],['007','007_commercial_documents.sql'],['008','008_receivables.sql'],['009','009_quotation_documents.sql'],['010','010_quotation_fee_access.sql'],['011','011_operational_pricing.sql'],['012','012_price_rules_vat_reference.sql'],['013','013_quotation_families.sql'],['014','014_document_workspaces.sql']]){
   if(!(await db.query('SELECT version FROM imperial.schema_migrations WHERE version=$1',[version])).rows.length){
    await db.exec(await readFile(`migrations/${file}`,'utf8'));
    await db.query('INSERT INTO imperial.schema_migrations(version) VALUES ($1)',[version]);
   }
  }
 });
}
