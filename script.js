// --------------------------
// Global references
// --------------------------
const pdfCanvas = document.getElementById('pdfCanvas');
const overlay = document.getElementById('overlay');
const ctx = overlay.getContext('2d', { willReadFrequently: true });
const fileInput = document.getElementById('fileInput');
const pageNumInput = document.getElementById('pageNum');
const pageCountSpan = document.getElementById('pageCount');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const scaleRange = document.getElementById('scaleRange');
const saveBtn = document.getElementById('saveBtn');
const status = document.getElementById('status');
const textBtn = document.getElementById('textBtn');
const pdfContainer = document.getElementById('pdf-container');
const textModal = new bootstrap.Modal(document.getElementById('textModal'));
const modalText = document.getElementById('modalText');
const modalFont = document.getElementById('modalFont');
const modalSize = document.getElementById('modalSize');
const modalColor = document.getElementById('modalColor');
const saveTextBtn = document.getElementById('saveTextBtn');

let pdfDoc = null, currentPage=1, totalPages=0, scale=parseFloat(scaleRange.value), originalPdfBytes=null;
const pageAnnotations = {};
const textBoxes = {}; // store HTML text boxes per page

// --------------------------
// Load PDF
// --------------------------
fileInput.addEventListener('change', async (e)=>{
  const file = e.target.files[0];
  if (!file) return;
  originalPdfBytes = await file.arrayBuffer();
  pdfDoc = await pdfjsLib.getDocument({data:new Uint8Array(originalPdfBytes)}).promise;
  totalPages = pdfDoc.numPages;
  pageCountSpan.textContent = '/ '+totalPages;
  currentPage = 1;
  renderPage(currentPage);
  saveBtn.disabled = false;
});

async function renderPage(num){
  const page = await pdfDoc.getPage(num);
  const viewport = page.getViewport({scale:scale});
  pdfCanvas.width=viewport.width; pdfCanvas.height=viewport.height;
  overlay.width=viewport.width; overlay.height=viewport.height;

  await page.render({canvasContext:pdfCanvas.getContext('2d'), viewport}).promise;
  ctx.clearRect(0,0,overlay.width,overlay.height);

  // Clear old text boxes
  pdfContainer.querySelectorAll('.text-box').forEach(e=>e.remove());
  (textBoxes[num]||[]).forEach(addTextBoxElement);

  pageNumInput.value=num;
  prevBtn.disabled = (num<=1);
  nextBtn.disabled = (num>=totalPages);
  status.textContent = `Page ${num} rendered`;
}

prevBtn.addEventListener('click', ()=>{ if(currentPage>1){ saveCurrent(); renderPage(--currentPage); }});
nextBtn.addEventListener('click', ()=>{ if(currentPage<totalPages){ saveCurrent(); renderPage(++currentPage); }});
pageNumInput.addEventListener('change', ()=>{ let v=parseInt(pageNumInput.value)||1; v=Math.max(1,Math.min(totalPages,v)); saveCurrent(); currentPage=v; renderPage(v); });
scaleRange.addEventListener('input', ()=>{ scale=parseFloat(scaleRange.value); saveCurrent(); renderPage(currentPage); });

function saveCurrent(){
  pageAnnotations[currentPage] = overlay.toDataURL();
  textBoxes[currentPage] = [...pdfContainer.querySelectorAll('.text-box')].map(box=>({
    text:box.innerText, font:box.style.fontFamily, size:parseInt(box.style.fontSize), color:box.style.color,
    x:box.offsetLeft, y:box.offsetTop, w:box.offsetWidth, h:box.offsetHeight
  }));
}

// --------------------------
// Text Tool
// --------------------------
textBtn.addEventListener('click', ()=>{
  modalText.value=''; modalFont.value='Arial'; modalSize.value=16; modalColor.value='#000000';
  saveTextBtn.onclick = ()=> {
    const data = { text:modalText.value, font:modalFont.value, size:parseInt(modalSize.value), color:modalColor.value, x:50, y:50, w:100, h:30 };
    textBoxes[currentPage] = textBoxes[currentPage]||[];
    textBoxes[currentPage].push(data);
    addTextBoxElement(data);
    textModal.hide();
  };
  textModal.show();
});

function addTextBoxElement(data){
  const div=document.createElement('div');
  div.className='text-box';
  div.contentEditable=false;
  div.innerText=data.text;
  div.style.left=data.x+'px'; div.style.top=data.y+'px';
  div.style.width=data.w+'px'; div.style.height=data.h+'px';
  div.style.fontFamily=data.font; div.style.fontSize=data.size+'px'; div.style.color=data.color;
  const handle=document.createElement('div'); handle.className='resize-handle'; div.appendChild(handle);
  pdfContainer.appendChild(div);

  // drag
  let dragging=false, startX=0,startY=0,origX=0,origY=0;
  div.addEventListener('mousedown',e=>{
    if(e.target===handle) return;
    dragging=true; startX=e.clientX; startY=e.clientY; origX=div.offsetLeft; origY=div.offsetTop;
    e.preventDefault();
  });
  document.addEventListener('mousemove',e=>{
    if(!dragging) return;
    div.style.left=origX+(e.clientX-startX)+'px';
    div.style.top=origY+(e.clientY-startY)+'px';
  });
  document.addEventListener('mouseup',()=>dragging=false);

  // resize
  let resizing=false,rStartX=0,rStartY=0,rW=0,rH=0;
  handle.addEventListener('mousedown',e=>{
    resizing=true; rStartX=e.clientX; rStartY=e.clientY; rW=div.offsetWidth; rH=div.offsetHeight;
    e.stopPropagation(); e.preventDefault();
  });
  document.addEventListener('mousemove',e=>{
    if(!resizing) return;
    div.style.width=rW+(e.clientX-rStartX)+'px';
    div.style.height=rH+(e.clientY-rStartY)+'px';
  });
  document.addEventListener('mouseup',()=>resizing=false);

  // edit on click
  div.addEventListener('dblclick',()=>{
    modalText.value=div.innerText;
    modalFont.value=div.style.fontFamily.replace(/\"/g,'');
    modalSize.value=parseInt(div.style.fontSize);
    modalColor.value=rgbToHex(div.style.color);
    saveTextBtn.onclick=()=>{
      div.innerText=modalText.value;
      div.style.fontFamily=modalFont.value;
      div.style.fontSize=modalSize.value+'px';
      div.style.color=modalColor.value;
      textModal.hide();
    };
    textModal.show();
  });
}

function rgbToHex(rgb){
  const m=rgb.match(/\d+/g); if(!m) return '#000000';
  return '#'+m.slice(0,3).map(x=>('0'+parseInt(x).toString(16)).slice(-2)).join('');
}

// --------------------------
// Save PDF
// --------------------------
saveBtn.addEventListener('click', async ()=>{
  saveCurrent();
  const pdfLibDoc = await PDFLib.PDFDocument.load(new Uint8Array(originalPdfBytes));
  const pages = pdfLibDoc.getPages();

  for(let i=0;i<pages.length;i++){
    const page=pages[i];
    const {width:pageW,height:pageH}=page.getSize();

    // draw overlay canvas
    const overlayData = pageAnnotations[i+1];
    if(overlayData){
      const imgBytes = dataURLToUint8(overlayData);
      const img = await pdfLibDoc.embedPng(imgBytes);
      page.drawImage(img,{x:0,y:0,width:pageW,height:pageH});
    }

    // draw text boxes
    (textBoxes[i+1]||[]).forEach(tb=>{
      page.drawText(tb.text,{
        x:tb.x,
        y:pageH-tb.y-tb.h,
        size:tb.size,
        font:pdfLibDoc.embedStandardFont(PDFLib.StandardFonts.Helvetica),
        color:PDFLib.rgb(...hexToRgb(tb.color).map(c=>c/255))
      });
    });
  }

  const pdfBytes = await pdfLibDoc.save();
  const blob=new Blob([pdfBytes],{type:'application/pdf'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a'); a.href=url; a.download='edited.pdf'; a.click();
  URL.revokeObjectURL(url);
});

function dataURLToUint8(dataURL){
  const base64=dataURL.split(',')[1]; const binary=atob(base64);
  const bytes=new Uint8Array(binary.length);
  for(let i=0;i<binary.length;i++) bytes[i]=binary.charCodeAt(i);
  return bytes;
}
function hexToRgb(hex){
  const bigint=parseInt(hex.slice(1),16);
  return [(bigint>>16)&255,(bigint>>8)&255, bigint&255];
}
