// The real PlayRobot website. Set it and a "Visit PlayRobot" button appears on every toy.
const PLAYROBOT_OFFICIAL = "";
const P={pip:{name:"Pip",price:49,tag:"Bestseller",img:"img/pip.jpg",desc:"The robot friend from every Nightlight story.",list:["Rolling wheels and a glowing star antenna","Friendly face with big oval eyes","Comes with a Learn-about-robots card"]},garden:{name:"Garden Helper",price:39,tag:"New",img:"img/garden.jpg",desc:"Fernhush Bay's leafy gardener.",list:["Little watering-can arm","Wobbly sprout on its head","Soft rubber wheels"]},book:{name:"Book Helper",price:39,tag:"Reading",img:"img/book.jpg",desc:"The Windowseat Library's reading buddy.",list:["Holds a tiny picture book","Perfect for bedtime pretend-play","Friendly glowing eyes"]},plush:{name:"Pip Plush",price:24,tag:"Snuggly",img:"img/plush.jpg",desc:"A soft, huggable Pip for the pillow.",list:["Felt star antenna","Stitched smile, no small parts","Machine washable"]}};
const $=(s)=>document.querySelector(s);let cart={};try{cart=JSON.parse(localStorage.getItem("pr_cart")||"{}")}catch(e){}
const save=()=>{try{localStorage.setItem("pr_cart",JSON.stringify(cart))}catch(e){}};
function toast(t){const e=$("#toast");e.textContent=t;e.classList.add("on");clearTimeout(window.__t);window.__t=setTimeout(()=>e.classList.remove("on"),2200)}
function render(){const ks=Object.keys(cart).filter(k=>cart[k]>0&&P[k]);$("#cartN").textContent=ks.reduce((a,k)=>a+cart[k],0);
$("#items").innerHTML=ks.length?ks.map(k=>`<div class="line"><img src="${P[k].img}" alt=""><div><b>${P[k].name}</b><div style="color:var(--muted);font-size:14px">$${P[k].price}</div></div><div class="qty"><button data-d="${k}" aria-label="One less">−</button><span>${cart[k]}</span><button data-i="${k}" aria-label="One more">+</button><button class="rm" data-r="${k}" aria-label="Remove ${P[k].name}" title="Remove">✕</button></div></div>`).join(""):'<p style="color:var(--muted)">Your cart is empty. Pip is waiting!</p>';
$("#sub").textContent="$"+ks.reduce((a,k)=>a+cart[k]*P[k].price,0)}
function add(k){cart[k]=(cart[k]||0)+1;save();render();toast(P[k].name+" added to your cart")}
const openCart=(on)=>{$("#drawer").classList.toggle("open",on);$("#scrim").classList.toggle("on",on)};
const closeAll=()=>{openCart(false);$("#modal").classList.remove("on");$("#done").classList.remove("on");$("#scrim").classList.remove("on")};
document.querySelectorAll(".add").forEach(b=>b.onclick=()=>add(b.dataset.sku));
document.querySelectorAll(".card").forEach(c=>{const k=c.querySelector(".add")?.dataset.sku;const im=c.querySelector(".img");if(!k||!im)return;
const show=()=>{const p=P[k];$("#mImg").src=p.img;$("#mImg").alt=p.name;$("#mName").textContent=p.name;$("#mTag").textContent=p.tag;$("#mDesc").textContent=p.desc;$("#mList").innerHTML=p.list.map(x=>`<li>${x}</li>`).join("");$("#mPrice").textContent="$"+p.price;$("#mAdd").onclick=()=>{add(k);closeAll()};const ob=$("#mOfficial");if(ob){ob.style.display=PLAYROBOT_OFFICIAL?"inline-flex":"none";ob.href=PLAYROBOT_OFFICIAL||"#";}$("#modal").classList.add("on");$("#scrim").classList.add("on")};
im.onclick=show;im.onkeydown=(e)=>{if(e.key==="Enter")show()}});
$("#items").onclick=(e)=>{const d=e.target.dataset;if(d.i)cart[d.i]++;if(d.d)cart[d.d]--;if(d.r)cart[d.r]=0;save();render()};
$("#cartBtn").onclick=()=>openCart(true);$("#closeCart").onclick=()=>openCart(false);$("#scrim").onclick=closeAll;$("#closeModal").onclick=closeAll;$("#closeDone").onclick=closeAll;
$("#checkout").onclick=()=>{if(!Object.values(cart).some(n=>n>0))return toast("Add a robot first");openCart(false);$("#done").classList.add("on");$("#scrim").classList.add("on");cart={};save();render()};
document.addEventListener("keydown",(e)=>{if(e.key==="Escape")closeAll()});render();
// Arriving from a Nightlight book (e.g. #pip) opens that toy straight away.
const openFromHash=()=>{const k=location.hash.slice(1);if(P[k]){const card=[...document.querySelectorAll(".card")].find(c=>c.querySelector(`.add[data-sku="${k}"]`));card?.scrollIntoView({behavior:"smooth",block:"center"});setTimeout(()=>card?.querySelector(".img")?.click(),400)}};window.addEventListener("hashchange",openFromHash);openFromHash();
