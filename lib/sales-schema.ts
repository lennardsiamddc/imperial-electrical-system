import {z} from 'zod';
import {decimal,optionalId,text} from './sales-common';
import {saleChannels,paymentTerms} from './sales-calculations';
import {entryModes,taxTreatments} from './vat';
export const saleLineSchema=z.object({id:z.uuid(),product_id:z.uuid(),quantity:decimal,uom:z.enum(['PCS','BOX','ROLL','METER']),price:decimal,vat_mode:z.enum(entryModes).default('VAT Exclusive'),tax_treatment:z.enum(taxTreatments).default('VATable'),discount:decimal.default('0')}).strict();
export const saleDraftSchema=z.object({vat_reference_mode:z.enum(['Included','Excluded']).default('Excluded'),price_list:z.enum(['Retail','Contractor']).default('Retail'),document_flow:z.enum(['SI','DR Only']).default('SI'),request_id:z.uuid(),id:z.uuid().optional(),version:z.number().int().positive().optional(),channel:z.enum(saleChannels),customer_id:optionalId,platform_id:optionalId,online_reference:text.default(''),occurred_at:z.iso.datetime({offset:true}),reference:text.default(''),terms:z.enum(paymentTerms),custom_terms:text.default(''),custom_due_date:z.string().default(''),salesperson_id:optionalId,notes:text.default(''),tax_config_version:z.number().int().positive().default(1),lines:z.array(saleLineSchema).min(1),
 payment:z.object({method_id:z.uuid(),account_id:optionalId,reference:text.default(''),check_bank:text.default(''),check_number:text.default(''),check_date:z.string().default(''),amount_received:decimal.default('0'),status:z.enum(['Unpaid','Partially Paid','Paid']).default('Unpaid')}).strict().optional(),
 documents:z.object({si:z.boolean(),dr:z.boolean()}).strict().optional()}).strict();
export type SaleDraftInput=z.infer<typeof saleDraftSchema>;
