// Preview host for client-web: serves the static files and forwards /api/* to the live Worker,
// so the app runs same-origin exactly as on Cloudflare Pages.
const http=require('http'),https=require('https'),fs=require('fs'),path=require('path');
const ROOT=__dirname, API='stella-catering-82j.pages.dev', PORT=8787;
const T={'.html':'text/html; charset=utf-8','.js':'application/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml'};
http.createServer((req,res)=>{
 const u=new URL(req.url,'http://x');
 if(u.pathname.startsWith('/api/')){
  const h={...req.headers,host:API};delete h.origin;delete h.referer;
  const up=https.request({host:API,path:req.url,method:req.method,headers:h},r=>{res.writeHead(r.statusCode,r.headers);r.pipe(res);});
  up.on('error',e=>{res.writeHead(502);res.end(String(e));});return req.pipe(up);
 }
 let p=decodeURIComponent(u.pathname);if(p==='/')p='/index.html';
 const f=path.join(ROOT,path.normalize(p));if(!f.startsWith(ROOT)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){res.writeHead(404);return res.end('not found');}
 res.writeHead(200,{'content-type':T[path.extname(f)]||'application/octet-stream','cache-control':'no-store'});fs.createReadStream(f).pipe(res);
}).listen(PORT,'0.0.0.0',()=>console.log('preview on',PORT));
