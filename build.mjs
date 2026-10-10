import {readFileSync,writeFileSync,mkdirSync,copyFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
mkdirSync('dist',{recursive:true});
for(const f of ['engine','app'])writeFileSync(`dist/${f}.js`,stripTypeScriptTypes(readFileSync(`src/${f}.ts`,'utf8'),{mode:'transform'}).replaceAll("'./engine.ts'","'./engine.js'"));
for(const f of ['index.html','style.css','sample.svg'])copyFileSync(`src/${f}`,`dist/${f}`);
