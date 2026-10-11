import {readFileSync,writeFileSync,mkdirSync,copyFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
mkdirSync('dist',{recursive:true});
for(const f of ['engine','app','auth','auth-bootstrap'])writeFileSync(`dist/${f}.js`,stripTypeScriptTypes(readFileSync(`src/${f}.ts`,'utf8'),{mode:'transform'}).replaceAll("'./engine.ts'","'./engine.js'").replaceAll("'./auth.ts'","'./auth.js'").replaceAll("'./auth-bootstrap.ts'","'./auth-bootstrap.js'"));
for(const f of ['index.html','style.css','sample.svg'])copyFileSync(`src/${f}`,`dist/${f}`);
copyFileSync('node_modules/@auth0/auth0-spa-js/dist/auth0-spa-js.production.esm.js','dist/auth0-spa-js.production.esm.js');
