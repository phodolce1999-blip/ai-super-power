'use strict';
// Load .env (no dependencies)
try{const __f=require('node:path').join(__dirname,'.env');if(require('node:fs').existsSync(__f)){for(const l of require('node:fs').readFileSync(__f,'utf8').split(/\r?\n/)){const m=l.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);if(m&&!(m[1] in process.env)){process.env[m[1]]=m[2].replace(/^['"]|['"]$/g,'');}}}}catch(e){console.warn('Cannot read .env:',e.message);}
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { URL } = require('node:url');
const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '0.0.0.0';
const ROOT = __dirname;
const DATA_PATH = process.env.DATA_PATH || path.join(ROOT, 'data', 'database.json');
const PUBLIC = path.join(ROOT, 'public');
const API_KEY = process.env.DEEPSEEK_API_KEY || process.env.OPENAI_API_KEY || '';
const MODEL = process.env.DEEPSEEK_MODEL || process.env.OPENAI_MODEL || 'deepseek-chat';
const AI_BASE_URL = (process.env.AI_BASE_URL || 'https://api.deepseek.com').replace(/\/+$/,'');
const COOKIE_SECURE = process.env.COOKIE_SECURE === 'true';
const DEV_ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@local.test';
const DEV_ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'ChangeMe123!';
const SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
const SESSION_DURATION = 7 * 24 * 3600 * 1000;
const sessions = new Map();
const hits = new Map();

function loadDB() {
  try { return JSON.parse(fs.readFileSync(DATA_PATH, 'utf8')); }
  catch { return {users:[],runs:[],settings:{siteName:'AI SUPER POWER',tagline:'Bộ công cụ sáng tạo & tự động hóa'},createdAt:new Date().toISOString()}; }
}
let db = loadDB();
function saveDB(){ fs.mkdirSync(path.dirname(DATA_PATH),{recursive:true}); const temp=DATA_PATH+'.tmp'; fs.writeFileSync(temp,JSON.stringify(db,null,2),{mode:0o600}); fs.renameSync(temp,DATA_PATH); }
function hashPassword(password,salt=crypto.randomBytes(16).toString('hex')) { return `${salt}:${crypto.scryptSync(password,salt,64).toString('hex')}`; }
function checkPassword(password,saved) { try {const [salt,hash] = saved.split(':'); return crypto.timingSafeEqual(Buffer.from(hash,'hex'),crypto.scryptSync(password,salt,64));} catch {return false;} }
function createUser(email,password,role='user',name='Người dùng') {const user={id:crypto.randomUUID(),email:email.trim().toLowerCase(),name,role,passwordHash:hashPassword(password),createdAt:new Date().toISOString()}; db.users.push(user);saveDB();return user;}
if(!db.users.some(u=>u.role==='admin')){createUser(DEV_ADMIN_EMAIL,DEV_ADMIN_PASSWORD,'admin','Quản trị viên'); console.log(`Admin initialized: ${DEV_ADMIN_EMAIL}`); }
if(!process.env.ADMIN_PASSWORD) console.warn('WARNING: Demo admin password in use. Set ADMIN_PASSWORD before public deployment.');
if(!process.env.SESSION_SECRET) console.warn('WARNING: Sessions reset on restart. Set SESSION_SECRET before public deployment.');
function send(res,status,data,headers={}) {const body=JSON.stringify(data);res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store',...headers});res.end(body);}
function err(res,status,message){send(res,status,{error:message});}
function parseCookies(req){const all={}; (req.headers.cookie||'').split(';').forEach(part=>{let i=part.indexOf('=');if(i>0) all[part.slice(0,i).trim()]=part.slice(i+1).trim()});return all;}
function sessionFor(req) {const sid=parseCookies(req).sid; if(!sid)return null; const [token,mac]=sid.split('.');if(!token||!mac)return null;const valid=crypto.createHmac('sha256',SECRET).update(token).digest('hex');if(mac.length!==valid.length||!crypto.timingSafeEqual(Buffer.from(mac),Buffer.from(valid)))return null;let s=sessions.get(token);if(!s||s.expires<Date.now()){sessions.delete(token);return null;}const user=db.users.find(u=>u.id===s.userId);return user||null;}
function publicUser(u){return {id:u.id,email:u.email,name:u.name,role:u.role,createdAt:u.createdAt};}
function issueSession(res,user){const token=crypto.randomBytes(32).toString('hex'); const mac=crypto.createHmac('sha256',SECRET).update(token).digest('hex');sessions.set(token,{userId:user.id,expires:Date.now()+SESSION_DURATION});res.setHeader('set-cookie',`sid=${token}.${mac}; HttpOnly; SameSite=Strict; Path=/; Max-Age=604800${COOKIE_SECURE?'; Secure':''}`);}
function requireUser(req,res,admin=false){const user=sessionFor(req);if(!user){err(res,401,'Vui lòng đăng nhập.');return null;}if(admin&&user.role!=='admin'){err(res,403,'Chỉ quản trị viên được truy cập.');return null;}return user;}
async function bodyOf(req){let text='';for await(const chunk of req){text+=chunk;if(text.length>100000)throw Error('Dữ liệu gửi lên quá lớn.');}try {return JSON.parse(text||'{}');} catch {throw Error('JSON không hợp lệ.');}}
function limited(req,limit=30){const ip=(process.env.TRUST_PROXY==='true'&&(req.headers['cf-connecting-ip']||req.headers['true-client-ip']||String(req.headers['x-forwarded-for']||'').split(',')[0].trim()))||req.socket.remoteAddress||'?';const now=Date.now();const v=hits.get(ip)||[];const recent=v.filter(t=>now-t<60000);recent.push(now);hits.set(ip,recent);return recent.length>limit;}
const DEFINITIONS={
 video:{name:'Studio Video AI',system:'Bạn là đạo diễn video ngắn. Soạn storyboard chi tiết, timeline cảnh quay, mô tả cảnh, lời thoại tiếng Việt, text overlay, caption, âm thanh và prompt để dựng video bằng công cụ video AI. Không được nói rằng video đã được render.',starter:'Tạo video quảng bá sản phẩm 30 giây cho TikTok, không cần lộ mặt.'},
 assistant:{name:'Trợ lý AI riêng',system:'Bạn là trợ lý điều hành cho người kinh doanh Việt Nam. Trả lời rõ ràng, có quy trình và checklist hành động cụ thể. Nếu thiếu dữ liệu, nêu giả định.' ,starter:'Thiết lập trợ lý AI chăm sóc khách hàng cho doanh nghiệp của tôi.'},
 ads:{name:'Viết quảng cáo',system:'Bạn là chuyên gia copywriting quảng cáo tại Việt Nam. Tạo 3 biến thể: ngắn, thuyết phục, kể chuyện. Đưa headline, body, CTA, đối tượng. Tránh lời hứa kết quả không có bằng chứng và tuyên bố gây hiểu lầm.',starter:'Viết 3 mẫu quảng cáo Facebook cho khóa học kỹ năng AI.'},
 design:{name:'Thiết kế hình ảnh & slide',system:'Bạn là art director. Tạo bản thiết kế có kích thước, phân cấp chữ, bảng màu HEX, bố cục, nội dung và prompt tạo hình phù hợp để dùng Canva hoặc công cụ ảnh AI. Không tuyên bố đã tạo file ảnh/slide nếu chỉ xuất văn bản.',starter:'Thiết kế poster quảng cáo khóa học AI tông xanh công nghệ.'},
 ideas:{name:'100 ý tưởng nội dung',system:'Bạn là content strategist. Lập ý tưởng nội dung theo nhóm chủ đề, đối tượng, mục tiêu, hook và định dạng. Nếu yêu cầu 100 ý tưởng, cung cấp đúng 100 ý tưởng được đánh số, ngắn gọn và không trùng.',starter:'Tạo 30 ý tưởng Reels trong tháng cho trung tâm đào tạo.'},
 workflow:{name:'Tự động hóa công việc',system:'Bạn là chuyên gia n8n/Make. Phân tích workflow với trigger, các bước, dữ liệu đầu vào đầu ra, nút cần tạo, điều kiện, chống trùng, xử lý lỗi và lưu ý API. Không nói rằng workflow đã kích hoạt hay đã kết nối ứng dụng.',starter:'Thiết kế luồng khi khách điền form: lưu Google Sheets và gửi email xác nhận.'}
};
async function invokeAI(mode,prompt){const def=DEFINITIONS[mode];if(!API_KEY)throw Object.assign(new Error('Chưa cấu hình DEEPSEEK_API_KEY. Hệ thống đang ở chế độ demo: bạn có thể xem mẫu và lưu nội dung nhập.'),{status:503});
 const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),75000);
 try{
  const resp=await fetch(`${AI_BASE_URL}/chat/completions`,{method:'POST',headers:{'authorization':`Bearer ${API_KEY}`,'content-type':'application/json'},body:JSON.stringify({model:MODEL,messages:[{role:'system',content:`Trả lời tiếng Việt. ${def.system}`},{role:'user',content:prompt}],max_tokens:mode==='ideas'?6000:2500,stream:false}),signal:controller.signal});
  const json=await resp.json().catch(()=>({}));if(!resp.ok)throw Object.assign(new Error(json.error?.message||`Không thể kết nối API AI (DeepSeek, HTTP ${resp.status}).`),{status:502});
  const answer=String(json.choices?.[0]?.message?.content||'').trim();return answer||'API không trả về văn bản.';
 } finally{clearTimeout(timeout);}
}
async function route(req,res){const url=new URL(req.url,'http://localhost'); const pathname=url.pathname;const method=req.method;
 if(pathname.startsWith('/api/')){
  if(limited(req,100))return err(res,429,'Bạn thao tác quá nhanh. Vui lòng thử lại.');
  try{
   if(pathname==='/api/config'&&method==='GET')return send(res,200,{configured:!!API_KEY,models:[MODEL],settings:db.settings,tools:Object.fromEntries(Object.entries(DEFINITIONS).map(([k,v])=>[k,{name:v.name,starter:v.starter}]))});
   if(pathname==='/api/me'&&method==='GET'){const user=sessionFor(req);return send(res,200,{user:user?publicUser(user):null});}
   if(pathname==='/api/login'&&method==='POST'){const b=await bodyOf(req);const user=db.users.find(u=>u.email===String(b.email||'').trim().toLowerCase());if(!user||!checkPassword(String(b.password||''),user.passwordHash))return err(res,401,'Email hoặc mật khẩu không đúng.');issueSession(res,user);return send(res,200,{user:publicUser(user)});}
   if(pathname==='/api/register'&&method==='POST'){const b=await bodyOf(req);const email=String(b.email||'').trim().toLowerCase();const pass=String(b.password||'');const name=String(b.name||'').trim().slice(0,80);if(!/^\S+@\S+\.\S+$/.test(email)||pass.length<10||!name)return err(res,400,'Nhập tên, email hợp lệ và mật khẩu tối thiểu 10 ký tự.');if(db.users.some(u=>u.email===email))return err(res,409,'Email đã tồn tại.');const user=createUser(email,pass,'user',name);issueSession(res,user);return send(res,201,{user:publicUser(user)});}
   if(pathname==='/api/logout'&&method==='POST'){const sid=parseCookies(req).sid||'';sessions.delete(sid.split('.')[0]);res.setHeader('set-cookie','sid=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');return send(res,200,{ok:true});}
   if(pathname==='/api/history'&&method==='GET'){const user=requireUser(req,res);if(!user)return;return send(res,200,{runs:db.runs.filter(r=>r.userId===user.id).slice(-100).reverse()});}
   if(pathname==='/api/generate'&&method==='POST'){const user=requireUser(req,res);if(!user)return; const b=await bodyOf(req);const mode=String(b.mode||'');const prompt=String(b.prompt||'').trim();if(!DEFINITIONS[mode])return err(res,400,'Chức năng không tồn tại.');if(prompt.length<5||prompt.length>8000)return err(res,400,'Nội dung yêu cầu phải có từ 5 đến 8.000 ký tự.');const output=await invokeAI(mode,prompt);const run={id:crypto.randomUUID(),userId:user.id,mode,prompt,output,createdAt:new Date().toISOString()};db.runs.push(run);if(db.runs.length>5000)db.runs=db.runs.slice(-5000);saveDB();return send(res,200,{run});}
   if(pathname==='/api/admin/overview'&&method==='GET'){const user=requireUser(req,res,true);if(!user)return;const byTool=Object.fromEntries(Object.keys(DEFINITIONS).map(k=>[k,db.runs.filter(r=>r.mode===k).length]));return send(res,200,{users:db.users.length,runs:db.runs.length,byTool,recent:db.runs.slice(-25).reverse().map(r=>({id:r.id,mode:r.mode,createdAt:r.createdAt,email:db.users.find(u=>u.id===r.userId)?.email||'N/A',prompt:r.prompt.slice(0,100)})),settings:db.settings,apiReady:!!API_KEY});}
   if(pathname==='/api/admin/users'&&method==='GET'){const user=requireUser(req,res,true);if(!user)return;return send(res,200,{users:db.users.map(publicUser)});}
   if(pathname==='/api/admin/settings'&&method==='POST'){const user=requireUser(req,res,true);if(!user)return;const b=await bodyOf(req);db.settings.siteName=String(b.siteName||'AI SUPER POWER').slice(0,50);db.settings.tagline=String(b.tagline||'').slice(0,120);saveDB();return send(res,200,{settings:db.settings});}
   if(pathname==='/api/password'&&method==='POST'){const user=requireUser(req,res);if(!user)return;const b=await bodyOf(req);if(!checkPassword(String(b.oldPassword||''),user.passwordHash))return err(res,403,'Mật khẩu cũ không đúng.');if(String(b.newPassword||'').length<10)return err(res,400,'Mật khẩu mới cần tối thiểu 10 ký tự.');user.passwordHash=hashPassword(String(b.newPassword));saveDB();return send(res,200,{ok:true});}
   return err(res,404,'API không tồn tại.');
  }catch(e){console.error('API error',e.message);return err(res,e.status||400,e.message||'Lỗi xử lý.');}
 }
 if(method!=='GET'&&method!=='HEAD'){res.writeHead(405);return res.end();}
 let filepath=pathname==='/'?path.join(PUBLIC,'index.html'):path.resolve(PUBLIC,'.'+decodeURIComponent(pathname));if(!filepath.startsWith(PUBLIC+path.sep)){res.writeHead(403);return res.end();}
 try{const stat=fs.statSync(filepath);if(!stat.isFile())throw Error('No file');const ext=path.extname(filepath);const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.ico':'image/x-icon'}[ext]||'application/octet-stream';res.writeHead(200,{'content-type':mime,'x-content-type-options':'nosniff','cache-control':'no-cache','content-security-policy':"default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self'; img-src 'self' data:; connect-src 'self'; font-src 'self'; frame-ancestors 'none'"});fs.createReadStream(filepath).pipe(res);}catch{res.writeHead(404,{'content-type':'text/plain; charset=utf-8'});res.end('Không tìm thấy trang.');}
}
http.createServer((req,res)=>{route(req,res).catch(e=>{console.error(e);if(!res.headersSent)err(res,500,'Lỗi máy chủ.');});}).listen(PORT,HOST,()=>console.log(`AI SUPER POWER running http://localhost:${PORT}`));
