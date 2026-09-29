import {closeDB} from '../lib/db';
import {migrate} from '../lib/migrations';
migrate().then(()=>console.log('All Imperial migrations applied.')).catch(e=>{console.error(e.message);process.exitCode=1;}).finally(closeDB);
