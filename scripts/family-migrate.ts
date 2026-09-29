import {migrate} from '../lib/migrations';import {closeDB} from '../lib/db';migrate().then(()=>console.log('Migration complete')).finally(closeDB);
