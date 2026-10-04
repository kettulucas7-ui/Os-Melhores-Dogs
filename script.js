const $ = s => document.querySelector(s);

const fallbackDogs = [
  {id:1,name:"Dog do Chef",neighborhood:"Centro",price:16,rating:4.9,reviews:128,hours:"Seg a Dom · 16h às 00h",description:"Pão macio, salsicha de qualidade, queijo, bacon, batata palha e molhos especiais.",image:"dog-1.jpg"},
  {id:2,name:"Dog Paulista",neighborhood:"Vila dos Remédios",price:14,rating:4.7,reviews:94,hours:"Seg a Sáb · 17h às 23h",description:"Salsicha, milho, ervilha, queijo, batata palha e muito sabor!",image:"dog-2.jpg"},
  {id:3,name:"Dog da Praça",neighborhood:"Centro",price:13,rating:4.8,reviews:176,hours:"Seg a Dom · 15h às 23h",description:"O clássico que nunca sai de moda! Pão, salsicha, queijo, batata palha e molhos especiais.",image:"dog-3.jpg"},
  {id:4,name:"Dog do Tio Zé",neighborhood:"Jardim das Flores",price:15,rating:4.6,reviews:81,hours:"Seg a Dom · 16h às 00h",description:"Muito recheio, muito sabor! Salsicha, queijo, bacon, milho, ervilha e batata palha.",image:"dog-4.jpg"}
];

const fallbackReviews = [
  {name:"Juliana Silva",rating:5,text:"O Dog do Chef é simplesmente incrível. Muito saboroso e bem recheado. Recomendo demais!",dog:"Dog do Chef",date:"Há 2 dias"},
  {name:"Carlos Almeida",rating:5,text:"Sempre peço no Dog da Praça. Atendimento top!",dog:"Dog da Praça",date:"Há 4 dias"},
  {name:"Fernanda Costa",rating:5,text:"Muito bem servido e o preço é justo. Nota 10!",dog:"Dog do Tio Zé",date:"Há 1 semana"}
];

let supabaseClient = null;
let dogs = [];
let selectedRating = 5;

function isConfigured(){
  return window.SUPABASE_URL &&
    window.SUPABASE_ANON_KEY &&
    !window.SUPABASE_URL.includes("COLE_AQUI") &&
    !window.SUPABASE_ANON_KEY.includes("COLE_AQUI");
}

function money(value){
  return Number(value).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
}

function stars(rating){
  const r = Math.max(0, Math.min(5, Math.round(Number(rating) || 0)));
  return "★".repeat(r) + "☆".repeat(5-r);
}

function escapeHtml(str){
  return String(str ?? "").replace(/[&<>"']/g,m=>({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'
  }[m]));
}

function showToast(message){
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(window.toastTimer);
  window.toastTimer = setTimeout(()=>toast.classList.remove("show"),3200);
}

async function init(){
  $("#year").textContent = new Date().getFullYear();

  if(isConfigured()){
    supabaseClient = window.supabase.createClient(
      window.SUPABASE_URL,
      window.SUPABASE_ANON_KEY
    );
    await loadOnlineData();
  } else {
    dogs = fallbackDogs;
    renderNeighborhoods();
    renderDogOptions();
    renderCards();
    renderReviews(fallbackReviews);
    showToast("Configure o Supabase para salvar avaliações para todos os visitantes.");
  }
}

async function loadOnlineData(){
  const {data:establishments,error:estError} = await supabaseClient
    .from("establishments")
    .select("*")
    .order("name");

  if(estError){
    console.error(estError);
    dogs = fallbackDogs;
    renderNeighborhoods();
    renderDogOptions();
    renderCards();
    renderReviews(fallbackReviews);
    showToast("Banco indisponível. Exibindo dados demonstrativos.");
    return;
  }

  dogs = establishments?.length ? establishments.map(d=>({
    ...d,
    rating:0,
    reviews:0,
    image: d.image_url || "imagens/hero-osaco-hot-dog.png"
  })) : fallbackDogs;

  await updateRatings();
  renderNeighborhoods();
  renderDogOptions();
  renderCards();
  await loadReviews();
}

async function updateRatings(){
  const {data,error} = await supabaseClient
    .from("reviews")
    .select("establishment_id,rating");

  if(error){
    console.error(error);
    return;
  }

  const stats = {};
  (data || []).forEach(r=>{
    stats[r.establishment_id] ||= {sum:0,count:0};
    stats[r.establishment_id].sum += Number(r.rating);
    stats[r.establishment_id].count++;
  });

  dogs = dogs.map(d=>{
    const s = stats[d.id] || {sum:0,count:0};
    return {
      ...d,
      reviews:s.count,
      rating:s.count ? Number((s.sum/s.count).toFixed(1)) : 0
    };
  });
}

async function loadReviews(){
  const {data,error} = await supabaseClient
    .from("reviews")
    .select(`
      id,rating,comment,photo_url,created_at,
      establishments(name)
    `)
    .order("created_at",{ascending:false})
    .limit(18);

  if(error){
    console.error(error);
    renderReviews(fallbackReviews);
    return;
  }

  const reviews = (data || []).map(r=>({
    name:r.author_name || "Visitante",
    rating:r.rating,
    text:r.comment,
    dog:r.establishments?.name || "",
    date:new Date(r.created_at).toLocaleDateString("pt-BR"),
    photo:r.photo_url || null
  }));

  renderReviews(reviews.length ? reviews : []);
}

function renderNeighborhoods(){
  $("#neighborhoodFilter").innerHTML =
    '<option value="todos">Todos os bairros</option>' +
    [...new Set(dogs.map(d=>d.neighborhood))].sort()
      .map(n=>`<option value="${escapeHtml(n)}">${escapeHtml(n)}</option>`).join("");
}

function renderDogOptions(){
  $("#reviewDog").innerHTML = dogs
    .map(d=>`<option value="${d.id}">${escapeHtml(d.name)}</option>`).join("");
}

function renderCards(){
  const search = $("#searchInput").value.trim().toLowerCase();
  const neighborhood = $("#neighborhoodFilter").value;
  const sort = $("#sortFilter").value;

  let filtered = dogs.filter(d=>{
    const text = `${d.name} ${d.description || ""}`.toLowerCase();
    return text.includes(search) &&
      (neighborhood === "todos" || d.neighborhood === neighborhood);
  });

  filtered.sort((a,b)=>{
    if(sort==="reviews") return b.reviews-a.reviews;
    if(sort==="priceLow") return Number(a.price)-Number(b.price);
    if(sort==="priceHigh") return Number(b.price)-Number(a.price);
    return Number(b.rating)-Number(a.rating);
  });

  $("#dogCards").innerHTML = filtered.map(d=>{
    const rating = Number(d.rating)||0;
    const image = d.image_url || d.image || "imagens/hero-osaco-hot-dog.png";
    return `
      <article class="dog-card">
        <div class="dog-image" style="background-image:url('${escapeHtml(image)}')">
          <span class="badge">${rating ? `★ ${rating.toFixed(1)}` : "Novo"}</span>
        </div>
        <div class="dog-body">
          <h3>${escapeHtml(d.name)}</h3>
          <div class="location">📍 ${escapeHtml(d.neighborhood)} - Osasco</div>
          <div class="rating">${rating ? stars(rating) : "☆☆☆☆☆"} <span>(${d.reviews || 0} avaliações)</span></div>
          <p class="description">${escapeHtml(d.description)}</p>
          <div class="price">${money(d.price)}</div>
          <div class="hours">🕐 ${escapeHtml(d.hours)}</div>
          <button class="btn btn-yellow card-btn" data-review="${d.id}">💬 Avaliar</button>
        </div>
      </article>`;
  }).join("");

  $("#emptyState").classList.toggle("hidden",filtered.length>0);
}

function renderReviews(reviews){
  const list = $("#reviewsList");

  if(!reviews.length){
    list.innerHTML = `
      <article class="review-card">
        <p>Ainda não há avaliações. Seja o primeiro a deixar uma opinião!</p>
      </article>`;
    return;
  }

  list.innerHTML = reviews.slice(0,12).map(r=>`
    <article class="review-card">
      <div class="review-top">
        <div style="display:flex;gap:10px;align-items:center">
          <div class="avatar">${escapeHtml((r.name || "V").charAt(0).toUpperCase())}</div>
          <div>
            <div class="review-name">${escapeHtml(r.name || "Visitante")}</div>
            <div class="review-date">${escapeHtml(r.date || "Agora")}</div>
          </div>
        </div>
        <div class="review-stars">${stars(r.rating)}</div>
      </div>
      <p>${escapeHtml(r.text)}</p>
      ${r.photo ? `<img class="review-photo" src="${escapeHtml(r.photo)}" alt="Foto enviada por visitante">` : ""}
      <div class="review-dog">🌭 ${escapeHtml(r.dog)}</div>
    </article>`).join("");
}

function openModal(dogId=null){
  $("#commentModal").classList.remove("hidden");
  document.body.style.overflow="hidden";
  if(dogId) $("#reviewDog").value=String(dogId);
  setRating(5);
}

function closeModal(){
  $("#commentModal").classList.add("hidden");
  document.body.style.overflow="";
}

function setRating(value){
  selectedRating = Number(value);
  $("#reviewRating").value = selectedRating;
  document.querySelectorAll("#starPicker button").forEach(btn=>{
    btn.classList.toggle("active",Number(btn.dataset.rating)<=selectedRating);
  });
}

async function uploadPhoto(file){
  if(!file) return null;

  if(file.size > 5*1024*1024){
    showToast("A foto deve ter no máximo 5 MB.");
    return {error:true};
  }

  const allowed = ["image/jpeg","image/png","image/webp"];
  if(!allowed.includes(file.type)){
    showToast("Use uma foto JPG, PNG ou WEBP.");
    return {error:true};
  }

  const extension = file.type === "image/png" ? "png" :
    file.type === "image/webp" ? "webp" : "jpg";

  // Nome aleatório para evitar colisões. Não contém dados pessoais.
  const path = `${crypto.randomUUID()}.${extension}`;

  const {error} = await supabaseClient.storage
    .from("review-photos")
    .upload(path,file,{
      contentType:file.type,
      upsert:false,
      cacheControl:"31536000"
    });

  if(error){
    console.error(error);
    showToast("Não foi possível enviar a foto.");
    return {error:true};
  }

  const {data} = supabaseClient.storage
    .from("review-photos")
    .getPublicUrl(path);

  return {url:data.publicUrl,path};
}

async function publishReview(e){
  e.preventDefault();

  const name = $("#reviewName").value.trim();
  const establishmentId = Number($("#reviewDog").value);
  const rating = Number($("#reviewRating").value);
  const comment = $("#reviewText").value.trim();
  const file = $("#reviewPhoto").files[0];

  if(name.length < 2 || name.length > 40){
    showToast("Digite um nome entre 2 e 40 caracteres.");
    return;
  }
  if(comment.length < 2 || comment.length > 300){
    showToast("O comentário deve ter entre 2 e 300 caracteres.");
    return;
  }

  // Se o Supabase ainda não estiver configurado, salva apenas localmente.
  if(!supabaseClient){
    const readerDone = photo => {
      const current = JSON.parse(localStorage.getItem("osascoHotDogReviews") || "[]");
      const dog = dogs.find(d=>d.id===establishmentId)?.name || "";
      current.push({name,rating,text:comment,dog,date:"Agora",photo});
      localStorage.setItem("osascoHotDogReviews",JSON.stringify(current));
      renderReviews(current.slice().reverse());
      e.target.reset();
      setRating(5);
      closeModal();
      showToast("⭐ Comentário salvo neste navegador. Configure o banco para compartilhar com todos.");
    };

    if(file){
      if(file.size > 5*1024*1024){showToast("A foto deve ter no máximo 5 MB.");return;}
      const reader = new FileReader();
      reader.onload = ()=>readerDone(reader.result);
      reader.readAsDataURL(file);
    }else readerDone(null);
    return;
  }

  // Upload opcional.
  let photoUrl = null;
  let photoPath = null;

  if(file){
    const uploaded = await uploadPhoto(file);
    if(uploaded?.error) return;
    photoUrl = uploaded.url;
    photoPath = uploaded.path;
  }

  const {error} = await supabaseClient.from("reviews").insert({
    establishment_id:establishmentId,
    author_name:name,
    rating,
    comment,
    photo_url:photoUrl,
    photo_path:photoPath
  });

  if(error){
    console.error(error);
    if(photoPath){
      await supabaseClient.storage.from("review-photos").remove([photoPath]);
    }
    showToast("Não foi possível publicar sua avaliação.");
    return;
  }

  e.target.reset();
  setRating(5);
  closeModal();
  await loadOnlineData();
  showToast("⭐ Sua avaliação foi publicada para todos os visitantes!");
}

$("#searchInput").addEventListener("input",renderCards);
$("#neighborhoodFilter").addEventListener("change",renderCards);
$("#sortFilter").addEventListener("change",renderCards);

document.addEventListener("click",e=>{
  const button=e.target.closest("[data-review]");
  if(button) openModal(Number(button.dataset.review));
});

["openCommentTop","openCommentHero","openCommentBottom","openCommentCta"].forEach(id=>{
  const el=$("#"+id);
  if(el) el.addEventListener("click",()=>openModal());
});

$("#closeModal").addEventListener("click",closeModal);
$("#closeModalBackdrop").addEventListener("click",closeModal);
$("#reviewForm").addEventListener("submit",publishReview);

document.querySelectorAll("#starPicker button").forEach(btn=>{
  btn.addEventListener("click",()=>setRating(btn.dataset.rating));
});

document.addEventListener("keydown",e=>{
  if(e.key==="Escape") closeModal();
});

$("#menuToggle").addEventListener("click",()=>{
  const menu=$("#menu");
  const open=menu.classList.toggle("open");
  $("#menuToggle").setAttribute("aria-expanded",open);
});

document.querySelectorAll("#menu a").forEach(a=>{
  a.addEventListener("click",()=>$("#menu").classList.remove("open"));
});

init();
