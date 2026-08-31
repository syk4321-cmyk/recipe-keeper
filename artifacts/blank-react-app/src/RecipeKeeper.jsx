// The uploaded component is intentionally kept as a JavaScript/JSX file so it
// can be pasted and edited without requiring TypeScript annotations.
import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Camera, Plus, X, ChevronLeft, Check, ShoppingCart,
  Loader2, Trash2, Search, FolderPlus, BookOpen, PencilLine, GripVertical,
  List, LayoutGrid, Settings2, ChefHat, Play, Pause, RotateCcw, ChevronRight,
  Lightbulb, ArrowBigUp, Flame, Sparkles,
} from "lucide-react";

const C = {
  ink: "#F7F0E6",
  card: "#FFF9F0",
  raised: "#EFE2E7",
  line: "#D8C6D1",
  ember: "#6B3F5C",
  emberSoft: "#EADCE7",
  turmeric: "#C47D58",
  scallion: "#6D927D",
  paper: "#332532",
  muted: "#786371",
};

// The original component used a host-provided window.storage API. Use a
// browser-backed adapter so recipes persist in the installed PWA as well as
// in a regular browser preview.
const browserStorage = {
  key(name, shared) {
    return `recipe-keeper:${shared ? "shared:" : ""}${name}`;
  },
  async get(name, shared = false) {
    const value = window.localStorage.getItem(this.key(name, shared));
    return value === null ? null : { value };
  },
  async set(name, value, shared = false) {
    window.localStorage.setItem(this.key(name, shared), value);
  },
};

const CATEGORY_EMOJI = {
  한식: "🍚", 중식: "🥡", 일식: "🍣", 양식: "🍝", 디저트: "🍰", 기타: "🍽️",
};
const CATEGORIES = Object.keys(CATEGORY_EMOJI);
const DEFAULT_FOLDERS = ["할래", "해먹음"];

// 재료 수량 문자열을 숫자+단위로 분리 (예: "700g" -> {value:700, unit:"g"})
function parseAmountStr(s) {
  if (!s) return null;
  const m = String(s).trim().match(/^([\d.]+)\s*(.*)$/);
  if (!m) return null;
  const value = parseFloat(m[1]);
  if (isNaN(value)) return null;
  return { value, unit: m[2].trim() };
}

// 같은 재료의 수량 두 개를 하나로 합치기. 단위가 같으면 숫자를 더하고, 다르면 나란히 표기
function mergeAmount(a, b) {
  const pa = parseAmountStr(a);
  const pb = parseAmountStr(b);
  if (pa && pb && pa.unit === pb.unit) {
    const sum = pa.value + pb.value;
    const val = Number.isInteger(sum) ? sum : Math.round(sum * 10) / 10;
    return `${val}${pa.unit}`;
  }
  if (!a) return b;
  if (!b) return a;
  if (a.trim() === b.trim()) return a;
  return `${a} + ${b}`;
}

// 인분수에 맞춰 재료 수량 다시 계산 (숫자로 시작하는 수량만 계산되고, "적당량"처럼 숫자가 없으면 그대로 둠)
function scaleAmount(amountStr, scale) {
  const parsed = parseAmountStr(amountStr);
  if (!parsed || !isFinite(scale) || scale <= 0) return amountStr;
  const scaled = Math.round(parsed.value * scale * 100) / 100;
  return `${scaled}${parsed.unit}`;
}

const uid = () => Math.random().toString(36).slice(2, 10);

// 조리 순서 문장에서 "5분", "30초", "1시간" 같은 시간 표현을 찾아 초 단위로 변환
function extractSeconds(text) {
  if (!text) return null;
  let total = 0;
  let found = false;
  const h = text.match(/(\d+)\s*시간/);
  if (h) { total += parseInt(h[1], 10) * 3600; found = true; }
  const m = text.match(/(\d+)\s*분/);
  if (m) { total += parseInt(m[1], 10) * 60; found = true; }
  const s = text.match(/(\d+)\s*초/);
  if (s) { total += parseInt(s[1], 10); found = true; }
  return found ? total : null;
}

function formatTime(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function playBeep() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 880;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    setTimeout(() => { osc.stop(); ctx.close(); }, 500);
  } catch (e) {}
}

// 손잡이를 눌러 세로로 드래그해서 목록 순서를 바꾸는 재사용 훅
function useReorderList(onReorder) {
  const itemRefs = useRef([]);
  const dragIndexRef = useRef(null);
  const dragStartYRef = useRef(0);
  const [dragActiveIndex, setDragActiveIndex] = useState(null);
  const [dragOffsetY, setDragOffsetY] = useState(0);

  function handleDragStart(e, idx) {
    e.preventDefault();
    dragIndexRef.current = idx;
    dragStartYRef.current = e.clientY ?? (e.touches && e.touches[0].clientY);
    setDragActiveIndex(idx);
    setDragOffsetY(0);
    document.body.style.userSelect = "none";
  }

  useEffect(() => {
    if (dragActiveIndex === null) return;
    function getY(ev) { return ev.clientY ?? (ev.touches && ev.touches[0] && ev.touches[0].clientY); }
    function onMove(ev) {
      const y = getY(ev);
      if (y == null) return;
      setDragOffsetY(y - dragStartYRef.current);
      const from = dragIndexRef.current;
      let target = from;
      itemRefs.current.forEach((el, i) => {
        if (!el) return;
        const rect = el.getBoundingClientRect();
        if (y > rect.top && y < rect.bottom) target = i;
      });
      if (target !== from) {
        onReorder(from, target);
        dragIndexRef.current = target;
        dragStartYRef.current = y;
        setDragOffsetY(0);
        setDragActiveIndex(target);
      }
    }
    function onUp() {
      dragIndexRef.current = null;
      setDragActiveIndex(null);
      setDragOffsetY(0);
      document.body.style.userSelect = "";
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("touchend", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onUp);
    };
  }, [dragActiveIndex, onReorder]);

  return { itemRefs, dragActiveIndex, dragOffsetY, handleDragStart };
}

function emptyDraft() {
  return {
    title: "",
    category: "기타",
    note: "",
    servings: 2,
    photos: [],
    ingredients: [{ id: uid(), name: "", amount: "" }],
    steps: [""],
  };
}

// 메모 속 링크(https://...)를 눌러서 바로 열 수 있게 자동으로 링크 처리
function linkify(text) {
  const parts = String(text || "").split(/(https?:\/\/[^\s]+)/g);
  return parts.map((part, i) =>
    /^https?:\/\//.test(part) ? (
      <a
        key={i}
        href={part}
        target="_blank"
        rel="noopener noreferrer"
        style={{ color: C.turmeric, textDecoration: "underline", wordBreak: "break-all" }}
      >
        {part}
      </a>
    ) : (
      <React.Fragment key={i}>{part}</React.Fragment>
    )
  );
}

function dataUrlToBase64(dataUrl) {
  return dataUrl.split(",")[1] || "";
}

// 완성 사진은 저장 공간을 아끼기 위해 적당한 크기로 줄여서 저장
async function compressImage(file, maxDim = 900, quality = 0.72) {
  const dataUrl = await new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(new Error("read fail"));
    r.readAsDataURL(file);
  });
  const img = await new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("image load fail"));
    image.src = dataUrl;
  });
  const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
  const w = Math.round(img.width * scale);
  const h = Math.round(img.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0, w, h);
  return canvas.toDataURL("image/jpeg", quality);
}

function parseModelJSON(data) {
  const text = (data.content || []).map((b) => b.text || "").join("\n").trim();
  const clean = text.replace(/```json|```/g, "").trim();
  const obj = JSON.parse(clean);
  return {
    title: obj.title || "제목 없음",
    category: CATEGORIES.includes(obj.category) ? obj.category : "기타",
    ingredients: Array.isArray(obj.ingredients) && obj.ingredients.length
      ? obj.ingredients.map((i) => ({ id: uid(), name: i.name || "", amount: i.amount || "" }))
      : [{ id: uid(), name: "", amount: "" }],
    steps: Array.isArray(obj.steps) && obj.steps.length ? obj.steps.filter(Boolean) : [""],
  };
}

function TEXT_PROMPT(text) {
  return `아래는 요리 영상/게시물의 제목, 설명, 댓글 등에서 가져온 텍스트입니다. 이 내용을 분석해서 레시피 정보를 아래 JSON 형식으로만 응답하세요. 다른 설명이나 코드블록 표시 없이 JSON 객체 하나만 출력하세요.

{"title":"요리 이름","category":"한식|중식|일식|양식|디저트|기타","ingredients":[{"name":"재료명","amount":"수량과 단위, 예: 700g, 1개, 3큰술"}],"steps":["조리 순서 설명"]}

텍스트:
"""${text}"""`;
}

const IMAGE_PROMPT = `이 이미지(들)는 요리 레시피와 관련된 스크린샷(인스타그램/유튜브 댓글, 게시물 본문, 캡션 등)입니다. 스크린샷이 여러 장이면 같은 레시피의 이어지는 내용일 수 있으니, 순서와 상관없이 모든 이미지의 내용을 종합해서 빠짐없이 하나의 레시피로 정리하세요.

중요한 규칙:
- 이미지에 적힌 재료명과 수량·단위(예: 700g, 3꼬집, 4T, 1개)는 절대 임의로 바꾸거나 생략하지 말고 화면에 보이는 그대로 옮기세요.
- 수량이 실제로 안 보이는 재료만 amount를 빈 문자열로 두세요. 보이는데 "적당량"으로 뭉뚱그리지 마세요.
- 조리 도구(후라이팬 등)는 재료 목록에 넣지 마세요.

아래 JSON 형식으로만 응답하세요. 다른 설명 없이 JSON 객체 하나만 출력하세요.

{"title":"요리 이름","category":"한식|중식|일식|양식|디저트|기타","ingredients":[{"name":"재료명","amount":"수량과 단위"}],"steps":["조리 순서"]}`;

async function callClaude(content) {
  const res = await fetch("/api/recipe/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || "AI analysis request failed");
  }
  return parseModelJSON(data);
}

function Chip({ active, children, onClick, style }) {
  return (
    <button
      onClick={onClick}
      className="px-3 py-1.5 rounded-full text-sm whitespace-nowrap shrink-0 transition-colors"
      style={{
        backgroundColor: active ? C.ember : C.raised,
        color: active ? C.paper : C.muted,
        border: `1px solid ${active ? C.ember : C.line}`,
        fontFamily: "'Gaegu', cursive",
        fontWeight: 700,
        ...style,
      }}
    >
      {children}
    </button>
  );
}

function ReceiptRow({ name, amount, mono = true }) {
  return (
    <div className="flex items-baseline gap-2 py-1.5">
      <span style={{ color: C.paper, fontFamily: "'Gaegu', cursive" }}>{name}</span>
      <span className="flex-1" style={{ borderBottom: `1px dotted ${C.line}`, transform: "translateY(-3px)" }} />
      <span style={{ color: C.turmeric, fontFamily: "'Gaegu', cursive", fontWeight: 700, fontSize: 15 }}>
        {amount}
      </span>
    </div>
  );
}

export default function RecipeKeeper() {
  const [view, setView] = useState("home");
  const [recipes, setRecipes] = useState([]);
  const [folders, setFolders] = useState(DEFAULT_FOLDERS);
  const [activeFolder, setActiveFolder] = useState("전체");
  const [shoppingList, setShoppingList] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [draft, setDraft] = useState(null);
  const [isEditingExisting, setIsEditingExisting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState("정리하는 중...");
  const [loadError, setLoadError] = useState("");
  const [showAddSheet, setShowAddSheet] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [showFolderManage, setShowFolderManage] = useState(false);
  const [confirmDeleteFolder, setConfirmDeleteFolder] = useState(null);
  const [showMoveFolder, setShowMoveFolder] = useState(false);

  // ---- 기능 제안 (모두에게 공유되는 데이터) ----
  const [suggestions, setSuggestions] = useState([]);
  const [votedIds, setVotedIds] = useState([]);
  const [suggestionSort, setSuggestionSort] = useState("votes"); // "votes" | "recent"
  const [newSuggestionText, setNewSuggestionText] = useState("");

  // ---- 요리 모드 ----
  const [cookingIndex, setCookingIndex] = useState(0);
  const [timerSeconds, setTimerSeconds] = useState(null);
  const [timerRunning, setTimerRunning] = useState(false);
  const timerIntervalRef = useRef(null);
  const wakeLockRef = useRef(null);

  async function requestWakeLock() {
    try {
      if (navigator.wakeLock) wakeLockRef.current = await navigator.wakeLock.request("screen");
    } catch (e) {}
  }
  function releaseWakeLock() {
    if (wakeLockRef.current) {
      wakeLockRef.current.release().catch(() => {});
      wakeLockRef.current = null;
    }
  }

  function startCooking() {
    setCookingIndex(0);
    setView("cooking");
    requestWakeLock();
  }
  function exitCooking() {
    clearInterval(timerIntervalRef.current);
    setTimerRunning(false);
    releaseWakeLock();
    setView("detail");
  }

  useEffect(() => {
    function handleVis() {
      if (document.visibilityState === "visible" && view === "cooking" && !wakeLockRef.current) requestWakeLock();
    }
    document.addEventListener("visibilitychange", handleVis);
    return () => document.removeEventListener("visibilitychange", handleVis);
  }, [view]);

  useEffect(() => {
    return () => {
      clearInterval(timerIntervalRef.current);
      releaseWakeLock();
    };
  }, []);

  useEffect(() => {
    if (view !== "cooking" || !selectedRecipe) return;
    clearInterval(timerIntervalRef.current);
    setTimerRunning(false);
    const step = selectedRecipe.steps[cookingIndex] || "";
    setTimerSeconds(extractSeconds(step));
    // eslint-disable-next-line
  }, [cookingIndex, view]);

  function startTimer() {
    if (timerSeconds == null || timerSeconds <= 0) return;
    setTimerRunning(true);
    clearInterval(timerIntervalRef.current);
    timerIntervalRef.current = setInterval(() => {
      setTimerSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(timerIntervalRef.current);
          setTimerRunning(false);
          playBeep();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }
  function pauseTimer() {
    clearInterval(timerIntervalRef.current);
    setTimerRunning(false);
  }
  function resetTimer() {
    pauseTimer();
    if (selectedRecipe) setTimerSeconds(extractSeconds(selectedRecipe.steps[cookingIndex] || ""));
  }
  const [textInput, setTextInput] = useState("");
  const [showTextBox, setShowTextBox] = useState(false);
  const [search, setSearch] = useState("");
  const [cardLayout, setCardLayout] = useState("list"); // "list" | "grid"
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [checkedIngredients, setCheckedIngredients] = useState({});
  const [viewServings, setViewServings] = useState(2);
  const [ready, setReady] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await browserStorage.get("recipes", false);
        if (r && r.value) {
          const parsed = JSON.parse(r.value);
          // 예전 버전(사진 1장)과의 호환을 위한 마이그레이션
          const migrated = parsed.map((rec) =>
            rec.photos ? rec : { ...rec, photos: rec.photo ? [rec.photo] : [] }
          );
          setRecipes(migrated);
        }
      } catch (e) {}
      try {
        const f = await browserStorage.get("folders", false);
        if (f && f.value) setFolders(JSON.parse(f.value));
      } catch (e) {}
      try {
        const l = await browserStorage.get("cardLayout", false);
        if (l && l.value) setCardLayout(l.value === "grid" ? "grid" : "list");
      } catch (e) {}
      try {
        const fs = await browserStorage.get("featureSuggestions", true);
        if (fs && fs.value) setSuggestions(JSON.parse(fs.value));
      } catch (e) {}
      try {
        const vi = await browserStorage.get("votedSuggestionIds", false);
        if (vi && vi.value) setVotedIds(JSON.parse(vi.value));
      } catch (e) {}
      try {
        const s = await browserStorage.get("shoppingList", false);
        if (s && s.value) {
          const parsed = JSON.parse(s.value);
          const migrated = parsed.map((item) =>
            item.recipeTitles ? item : { ...item, recipeTitles: item.recipeTitle ? [item.recipeTitle] : [] }
          );
          setShoppingList(migrated);
        }
      } catch (e) {}
      setReady(true);
    })();
  }, []);

  useEffect(() => { if (ready) browserStorage.set("recipes", JSON.stringify(recipes), false).catch(() => {}); }, [recipes, ready]);
  useEffect(() => { if (ready) browserStorage.set("folders", JSON.stringify(folders), false).catch(() => {}); }, [folders, ready]);
  useEffect(() => { if (ready) browserStorage.set("cardLayout", cardLayout, false).catch(() => {}); }, [cardLayout, ready]);
  useEffect(() => { if (ready) browserStorage.set("featureSuggestions", JSON.stringify(suggestions), true).catch(() => {}); }, [suggestions, ready]);
  useEffect(() => { if (ready) browserStorage.set("votedSuggestionIds", JSON.stringify(votedIds), false).catch(() => {}); }, [votedIds, ready]);

  function addSuggestion() {
    const text = newSuggestionText.trim();
    if (!text) return;
    const item = { id: uid(), text, votes: 1, createdAt: Date.now() };
    setSuggestions((prev) => [item, ...prev]);
    setVotedIds((prev) => [...prev, item.id]);
    setNewSuggestionText("");
  }

  function toggleVote(id) {
    const already = votedIds.includes(id);
    setSuggestions((prev) => prev.map((s) => (s.id === id ? { ...s, votes: s.votes + (already ? -1 : 1) } : s)));
    setVotedIds((prev) => (already ? prev.filter((v) => v !== id) : [...prev, id]));
  }
  useEffect(() => { if (ready) browserStorage.set("shoppingList", JSON.stringify(shoppingList), false).catch(() => {}); }, [shoppingList, ready]);

  function openPreview(parsed, source, sourceNote) {
    setDraft({ ...parsed, note: "", servings: 2, photos: [], id: uid(), source, sourceNote, folder: folders[0] || "할래", createdAt: Date.now() });
    setIsEditingExisting(false);
    setShowAddSheet(false);
    setShowTextBox(false);
    setTextInput("");
    setView("preview");
  }

  function openEditExisting(recipe) {
    setDraft({
      ...recipe,
      note: recipe.note || "",
      servings: recipe.servings || 2,
      photos: recipe.photos ? [...recipe.photos] : [],
      ingredients: recipe.ingredients.map((i) => ({ ...i })),
      steps: [...recipe.steps],
    });
    setIsEditingExisting(true);
    setLoadError("");
    setView("preview");
  }

  function isBareLink(s) {
    const t = s.trim();
    return /^https?:\/\/\S+$/i.test(t) && !t.includes(" ") && !t.includes("\n");
  }

  async function handleTextSubmit() {
    if (!textInput.trim()) return;
    if (isBareLink(textInput)) {
      setLoadError("링크만으로는 내용을 읽을 수 없어요. 영상 아래 설명이나 댓글에 적힌 재료·순서 텍스트를 복사해서 링크와 함께 붙여넣어주세요.");
      return;
    }
    setLoadError("");
    setLoading(true);
    setLoadingMsg("텍스트를 분석해서 레시피로 정리하는 중...");
    try {
      const parsed = await callClaude([{ type: "text", text: TEXT_PROMPT(textInput) }]);
      openPreview(parsed, "manual", textInput.slice(0, 200));
    } catch (e) {
      setLoadError("분석에 실패했어요. 아래에서 직접 채워 넣을 수 있어요.");
      openPreview(emptyDraft(), "manual", textInput.slice(0, 200));
    }
    setLoading(false);
  }

  async function handlePhotoPick(e) {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (!files.length) return;
    setLoading(true);
    setLoadingMsg(files.length > 1 ? `스크린샷 ${files.length}장 속 글자를 읽는 중...` : "스크린샷 속 글자를 읽는 중...");
    setLoadError("");
    try {
      const imageBlocks = await Promise.all(
        files.map(async (file) => {
          // 원본 사진은 휴대폰에서 수 MB가 될 수 있어, AI 요청 전 OCR에 충분한
          // 해상도로 줄여 업로드 본문이 프록시/서버 제한을 넘지 않게 한다.
          const compressedDataUrl = await compressImage(file, 1800, 0.84);
          return {
            type: "image",
            source: {
              type: "base64",
              media_type: "image/jpeg",
              data: dataUrlToBase64(compressedDataUrl),
            },
          };
        })
      );
      const parsed = await callClaude([...imageBlocks, { type: "text", text: IMAGE_PROMPT }]);
      openPreview(parsed, "photo", files.length > 1 ? `스크린샷 ${files.length}장에서 가져옴` : "스크린샷에서 가져옴");
    } catch (e) {
      setLoadError("이미지 분석에 실패했어요. 아래에서 직접 채워 넣을 수 있어요.");
      openPreview(emptyDraft(), "photo", "스크린샷에서 가져옴");
    }
    setLoading(false);
  }

  function updateDraft(patch) { setDraft((d) => ({ ...d, ...patch })); }
  const [photoBusy, setPhotoBusy] = useState(false);
  async function handleDraftPhotos(e) {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (!files.length) return;
    setPhotoBusy(true);
    try {
      const compressed = await Promise.all(files.map((f) => compressImage(f)));
      setDraft((d) => ({ ...d, photos: [...(d.photos || []), ...compressed] }));
    } catch (err) {
      setLoadError("사진을 불러오지 못했어요. 다른 사진으로 시도해보세요.");
    }
    setPhotoBusy(false);
  }
  function removeDraftPhoto(idx) {
    setDraft((d) => ({ ...d, photos: d.photos.filter((_, i) => i !== idx) }));
  }
  function makeThumbnail(idx) {
    setDraft((d) => {
      const photos = [...d.photos];
      const [chosen] = photos.splice(idx, 1);
      photos.unshift(chosen);
      return { ...d, photos };
    });
  }
  function updateIngredient(id, patch) {
    setDraft((d) => ({ ...d, ingredients: d.ingredients.map((i) => (i.id === id ? { ...i, ...patch } : i)) }));
  }
  function addIngredientRow() {
    setDraft((d) => ({ ...d, ingredients: [...d.ingredients, { id: uid(), name: "", amount: "" }] }));
  }
  function removeIngredientRow(id) {
    setDraft((d) => ({ ...d, ingredients: d.ingredients.filter((i) => i.id !== id) }));
  }
  function updateStep(idx, val) {
    setDraft((d) => ({ ...d, steps: d.steps.map((s, i) => (i === idx ? val : s)) }));
  }
  function addStepRow() { setDraft((d) => ({ ...d, steps: [...d.steps, ""] })); }
  function removeStepRow(idx) { setDraft((d) => ({ ...d, steps: d.steps.filter((_, i) => i !== idx) })); }

  const reorderSteps = useCallback((from, target) => {
    setDraft((d) => {
      const steps = [...d.steps];
      const [moved] = steps.splice(from, 1);
      steps.splice(target, 0, moved);
      return { ...d, steps };
    });
  }, []);
  const stepDrag = useReorderList(reorderSteps);

  const reorderIngredients = useCallback((from, target) => {
    setDraft((d) => {
      const ingredients = [...d.ingredients];
      const [moved] = ingredients.splice(from, 1);
      ingredients.splice(target, 0, moved);
      return { ...d, ingredients };
    });
  }, []);
  const ingredientDrag = useReorderList(reorderIngredients);

  function saveDraft() {
    if (!draft.title.trim()) return;
    const clean = {
      ...draft,
      ingredients: draft.ingredients.filter((i) => i.name.trim()),
      steps: draft.steps.filter((s) => s.trim()),
    };
    if (isEditingExisting) {
      setRecipes((prev) => prev.map((r) => (r.id === clean.id ? clean : r)));
    } else {
      setRecipes((prev) => [clean, ...prev]);
    }
    if (!folders.includes(clean.folder)) setFolders((prev) => [...prev, clean.folder]);
    const wasEditing = isEditingExisting;
    setDraft(null);
    setIsEditingExisting(false);
    if (wasEditing) {
      setSelectedId(clean.id);
      setView("detail");
    } else {
      setActiveFolder("전체");
      setView("home");
    }
  }

  function deleteRecipe(id) {
    setRecipes((prev) => prev.filter((r) => r.id !== id));
    setView("home");
  }

  function addFolder() {
    const name = newFolderName.trim();
    if (!name) return;
    if (!folders.includes(name)) setFolders((prev) => [...prev, name]);
    setNewFolderName("");
    setNewFolderOpen(false);
  }

  function performDeleteFolder(name) {
    const remainingFolders = folders.filter((f) => f !== name);
    const fallback = remainingFolders[0] || "할래";
    setFolders(remainingFolders.length ? remainingFolders : ["할래"]);
    setRecipes((prev) => prev.map((r) => (r.folder === name ? { ...r, folder: fallback } : r)));
    if (activeFolder === name) setActiveFolder("전체");
    setConfirmDeleteFolder(null);
  }

  function moveRecipeToFolder(recipeId, folder) {
    setRecipes((prev) => prev.map((r) => (r.id === recipeId ? { ...r, folder } : r)));
    setShowMoveFolder(false);
  }

  function openDetail(id) {
    setSelectedId(id);
    setCheckedIngredients({});
    const r = recipes.find((rec) => rec.id === id);
    setViewServings((r && r.servings) || 2);
    setView("detail");
  }

  function addCheckedToShoppingList(recipe) {
    const baseServings = recipe.servings || 2;
    const scale = viewServings / baseServings;
    const ids = Object.keys(checkedIngredients).filter((k) => checkedIngredients[k]);
    const toAdd = recipe.ingredients.filter((i) => ids.includes(i.id));
    if (!toAdd.length) return;
    setShoppingList((prev) => {
      const list = prev.map((item) => ({ ...item, recipeTitles: item.recipeTitles ? [...item.recipeTitles] : [item.recipeTitle].filter(Boolean) }));
      toAdd.forEach((ing) => {
        const normName = ing.name.trim();
        const scaledAmount = scaleAmount(ing.amount, scale);
        const idx = list.findIndex((item) => !item.checked && item.name.trim().toLowerCase() === normName.toLowerCase());
        if (idx >= 0) {
          list[idx] = {
            ...list[idx],
            amount: mergeAmount(list[idx].amount, scaledAmount),
            recipeTitles: list[idx].recipeTitles.includes(recipe.title)
              ? list[idx].recipeTitles
              : [...list[idx].recipeTitles, recipe.title],
          };
        } else {
          list.push({ id: uid(), name: normName, amount: scaledAmount, checked: false, recipeTitles: [recipe.title] });
        }
      });
      return list;
    });
    setView("shopping");
  }

  const selectedRecipe = recipes.find((r) => r.id === selectedId);

  const visibleRecipes = recipes.filter((r) => {
    const matchesFolder = activeFolder === "전체" || r.folder === activeFolder;
    const q = search.trim().toLowerCase();
    const matchesSearch =
      !q ||
      r.title.toLowerCase().includes(q) ||
      (r.ingredients || []).some((i) => i.name.toLowerCase().includes(q));
    return matchesFolder && matchesSearch;
  });

  return (
    <div
      style={{ backgroundColor: C.ink, minHeight: "100%", color: C.paper, fontFamily: "'Gaegu', cursive" }}
      className="cookmark-app w-full max-w-md mx-auto relative flex flex-col"
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Gaegu:wght@400;700&family=Jua&display=swap');
        ::-webkit-scrollbar { display: none; }
        * { -ms-overflow-style: none; scrollbar-width: none; }
        input, textarea { outline: none; }
      `}</style>

      {/* ---------- HOME ---------- */}
      {view === "home" && (
        <div className="flex flex-col flex-1 pb-24">
          <div className="px-5 pt-6 pb-2 flex items-start justify-between">
            <div>
              <h1 style={{ fontFamily: "'Jua', sans-serif", fontSize: 30, color: C.paper }}>쿡마크</h1>
              <p style={{ color: C.muted, fontSize: 15, marginTop: 2 }}>
                {recipes.length}개의 레시피를 모아뒀어요
              </p>
            </div>
            <button
              onClick={() => setView("features")}
              className="flex items-center gap-1 px-3 py-2 rounded-full mt-1 shrink-0"
              style={{ backgroundColor: C.card, border: `1px solid ${C.line}`, color: C.turmeric }}
            >
              <Lightbulb size={15} />
              <span style={{ fontSize: 14, fontWeight: 700 }}>기능 제안</span>
            </button>
          </div>

          <div className="px-5 py-2 flex items-center gap-2">
            <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-xl" style={{ backgroundColor: C.card, border: `1px solid ${C.line}` }}>
              <Search size={16} color={C.muted} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="이름이나 재료로 찾기 (예: 대파)"
                className="bg-transparent flex-1 text-sm"
                style={{ color: C.paper }}
              />
            </div>
            <div className="flex items-center gap-0.5 shrink-0 rounded-full p-0.5" style={{ backgroundColor: C.card, border: `1px solid ${C.line}` }}>
              <button
                onClick={() => setCardLayout("list")}
                className="w-8 h-8 rounded-full flex items-center justify-center"
                style={{ backgroundColor: cardLayout === "list" ? C.ember : "transparent", color: cardLayout === "list" ? C.paper : C.muted }}
                aria-label="리스트형 보기"
              >
                <List size={15} />
              </button>
              <button
                onClick={() => setCardLayout("grid")}
                className="w-8 h-8 rounded-full flex items-center justify-center"
                style={{ backgroundColor: cardLayout === "grid" ? C.ember : "transparent", color: cardLayout === "grid" ? C.paper : C.muted }}
                aria-label="그리드형 보기"
              >
                <LayoutGrid size={15} />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 px-5 py-3 overflow-x-auto">
            <Chip active={activeFolder === "전체"} onClick={() => setActiveFolder("전체")}>전체</Chip>
            {folders.map((f) => (
              <Chip key={f} active={activeFolder === f} onClick={() => setActiveFolder(f)}>{f}</Chip>
            ))}
            {!newFolderOpen ? (
              <Chip onClick={() => setNewFolderOpen(true)} style={{ backgroundColor: "transparent" }}>
                <span className="flex items-center gap-1"><FolderPlus size={14} /> 폴더</span>
              </Chip>
            ) : (
              <div className="flex items-center gap-1 shrink-0">
                <input
                  autoFocus
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addFolder()}
                  placeholder="폴더 이름"
                  className="px-2 py-1 rounded-full text-sm w-24"
                  style={{ backgroundColor: C.raised, color: C.paper, border: `1px solid ${C.line}` }}
                />
                <button onClick={addFolder} style={{ color: C.scallion }}><Check size={18} /></button>
                <button onClick={() => setNewFolderOpen(false)} style={{ color: C.muted }}><X size={18} /></button>
              </div>
            )}
            <button
              onClick={() => setShowFolderManage(true)}
              className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center"
              style={{ backgroundColor: C.raised, color: C.muted }}
              aria-label="폴더 관리"
            >
              <Settings2 size={14} />
            </button>
          </div>

          <div className={cardLayout === "grid" ? "px-5 grid grid-cols-2 gap-3 mt-2" : "px-5 flex flex-col gap-3 mt-2"}>
            {visibleRecipes.length === 0 && (
              <div className="text-center py-16 col-span-2" style={{ color: C.muted }}>
                <div style={{ fontSize: 36 }}>🗒️</div>
                <p className="mt-3 text-sm leading-relaxed">
                  아직 저장된 레시피가 없어요.<br />+ 버튼을 눌러 첫 레시피를 담아보세요.
                </p>
              </div>
            )}
            {cardLayout === "list"
              ? visibleRecipes.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => openDetail(r.id)}
                    className="flex items-center gap-3 p-3 rounded-2xl text-left"
                    style={{ backgroundColor: C.card, border: `1px solid ${C.line}` }}
                  >
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 overflow-hidden"
                      style={{ backgroundColor: C.raised, fontSize: 22 }}
                    >
                      {r.photos && r.photos[0] ? (
                        <img src={r.photos[0]} alt={r.title} className="w-full h-full object-cover" />
                      ) : (
                        CATEGORY_EMOJI[r.category] || "🍽️"
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold truncate" style={{ color: C.paper }}>{r.title}</div>
                      <div className="flex items-center gap-2 mt-1">
                        <span
                          className="text-xs px-2 py-0.5 rounded-full"
                          style={{ backgroundColor: C.emberSoft, color: C.ember, fontWeight: 700 }}
                        >
                          {r.folder}
                        </span>
                        <span style={{ color: C.muted, fontSize: 14 }}>
                          {r.source === "photo" ? "📸 스크린샷" : "✍️ 직접입력"}
                        </span>
                      </div>
                    </div>
                  </button>
                ))
              : visibleRecipes.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => openDetail(r.id)}
                    className="rounded-2xl text-left overflow-hidden"
                    style={{ backgroundColor: C.card, border: `1px solid ${C.line}` }}
                  >
                    <div
                      className="w-full flex items-center justify-center overflow-hidden"
                      style={{ height: 92, backgroundColor: C.raised, fontSize: 30 }}
                    >
                      {r.photos && r.photos[0] ? (
                        <img src={r.photos[0]} alt={r.title} className="w-full h-full object-cover" />
                      ) : (
                        CATEGORY_EMOJI[r.category] || "🍽️"
                      )}
                    </div>
                    <div className="p-2.5">
                      <div className="font-bold text-sm truncate" style={{ color: C.paper }}>{r.title}</div>
                      <span
                        className="inline-block mt-1.5 text-xs px-2 py-0.5 rounded-full"
                        style={{ backgroundColor: C.emberSoft, color: C.ember, fontWeight: 700 }}
                      >
                        {r.folder}
                      </span>
                    </div>
                  </button>
                ))}
          </div>
        </div>
      )}

      {/* ---------- PREVIEW / EDIT ---------- */}
      {view === "preview" && draft && (
        <div className="flex flex-col flex-1 pb-24">
          <div className="flex items-center gap-3 px-4 py-4">
            <button
              onClick={() => {
                const backTo = isEditingExisting ? "detail" : "home";
                setDraft(null);
                setIsEditingExisting(false);
                setView(backTo);
              }}
            >
              <X size={22} color={C.paper} />
            </button>
            <span className="font-bold" style={{ color: C.paper }}>
              {isEditingExisting ? "레시피 수정하기" : "레시피 확인하기"}
            </span>
          </div>

          {loadError && (
            <div className="mx-4 mb-3 px-3 py-2 rounded-lg text-sm" style={{ backgroundColor: C.emberSoft, color: C.ember }}>
              {loadError}
            </div>
          )}

          <div className="px-4 flex flex-col gap-5">
            <div>
              <label style={{ color: C.muted, fontSize: 14 }}>요리 이름</label>
              <input
                value={draft.title}
                onChange={(e) => updateDraft({ title: e.target.value })}
                placeholder="예: 류수영 불양념치킨"
                className="w-full mt-1 px-3 py-3 rounded-xl text-lg font-bold"
                style={{ backgroundColor: C.card, color: C.paper, border: `1px solid ${C.line}` }}
              />
            </div>

            <div>
              <label style={{ color: C.muted, fontSize: 14 }}>메모</label>
              <textarea
                value={draft.note}
                onChange={(e) => updateDraft({ note: e.target.value })}
                rows={3}
                placeholder={"예) 시어머니 스타일 제육볶음\n영상 링크: https://instagram.com/reel/..."}
                className="w-full mt-1 px-3 py-2 rounded-xl text-sm"
                style={{ backgroundColor: C.card, color: C.paper, border: `1px solid ${C.line}` }}
              />
              <p style={{ color: C.muted, fontSize: 13, marginTop: 2 }}>
                여기 적은 링크는 상세 화면에서 눌러서 바로 열 수 있어요
              </p>
            </div>

            <div>
              <label style={{ color: C.muted, fontSize: 14 }}>완성 사진</label>
              <p style={{ color: C.muted, fontSize: 13, marginTop: 2 }}>
                여러 장 올릴 수 있어요. 맨 앞 사진이 목록 썸네일로 쓰여요.
              </p>
              <div className="flex gap-2 mt-2 overflow-x-auto pb-1">
                {(draft.photos || []).map((p, idx) => (
                  <div key={idx} className="relative shrink-0" style={{ width: 96, height: 96 }}>
                    <img
                      src={p}
                      alt={`사진 ${idx + 1}`}
                      className="w-full h-full object-cover rounded-xl"
                      style={{ border: idx === 0 ? `2px solid ${C.ember}` : `1px solid ${C.line}` }}
                    />
                    {idx === 0 && (
                      <span
                        className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded-full font-bold"
                        style={{ backgroundColor: C.ember, color: C.paper, fontSize: 12 }}
                      >
                        대표
                      </span>
                    )}
                    {idx !== 0 && (
                      <button
                        onClick={() => makeThumbnail(idx)}
                        className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded-full"
                        style={{ backgroundColor: "#000000aa", color: C.paper, fontSize: 12 }}
                      >
                        대표로
                      </button>
                    )}
                    <button
                      onClick={() => removeDraftPhoto(idx)}
                      className="absolute top-1 right-1 w-5 h-5 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: "#000000aa" }}
                    >
                      <X size={11} color="#fff" />
                    </button>
                  </div>
                ))}

                <label
                  htmlFor="dish-photo-upload"
                  className="shrink-0 flex flex-col items-center justify-center gap-1 rounded-xl cursor-pointer"
                  style={{ width: 96, height: 96, backgroundColor: C.card, border: `1px dashed ${C.line}`, color: C.muted }}
                >
                  <Camera size={20} />
                  <span style={{ fontSize: 13 }}>{photoBusy ? "불러오는 중" : "사진 추가"}</span>
                </label>
                <input
                  id="dish-photo-upload"
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={handleDraftPhotos}
                />
              </div>
            </div>

            <div>
              <label style={{ color: C.muted, fontSize: 14 }}>카테고리</label>
              <div className="flex gap-2 mt-1 overflow-x-auto">
                {CATEGORIES.map((c) => (
                  <Chip key={c} active={draft.category === c} onClick={() => updateDraft({ category: c })}>
                    {CATEGORY_EMOJI[c]} {c}
                  </Chip>
                ))}
              </div>
            </div>

            <div>
              <label style={{ color: C.muted, fontSize: 14 }}>폴더</label>
              <div className="flex gap-2 mt-1 overflow-x-auto">
                {folders.map((f) => (
                  <Chip key={f} active={draft.folder === f} onClick={() => updateDraft({ folder: f })}>{f}</Chip>
                ))}
              </div>
            </div>

            <div>
              <label style={{ color: C.muted, fontSize: 14 }}>몇 인분 기준인가요?</label>
              <div className="flex items-center gap-3 mt-1">
                <button
                  onClick={() => updateDraft({ servings: Math.max(1, (draft.servings || 2) - 1) })}
                  className="w-9 h-9 rounded-full flex items-center justify-center font-bold"
                  style={{ backgroundColor: C.raised, color: C.paper }}
                >
                  −
                </button>
                <span style={{ color: C.paper, fontWeight: 700, minWidth: 56, textAlign: "center" }}>
                  {draft.servings || 2}인분
                </span>
                <button
                  onClick={() => updateDraft({ servings: (draft.servings || 2) + 1 })}
                  className="w-9 h-9 rounded-full flex items-center justify-center font-bold"
                  style={{ backgroundColor: C.raised, color: C.paper }}
                >
                  +
                </button>
              </div>
              <p style={{ color: C.muted, fontSize: 13, marginTop: 4 }}>
                재료 양이 이 기준으로 저장돼요. 상세화면에서 인분수를 바꾸면 자동으로 계산돼요.
              </p>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label style={{ color: C.muted, fontSize: 14 }}>재료</label>
                <button onClick={addIngredientRow} style={{ color: C.turmeric, fontSize: 15 }} className="flex items-center gap-1">
                  <Plus size={14} /> 재료 추가
                </button>
              </div>
              <p style={{ color: C.muted, fontSize: 13, marginTop: 2 }}>≡ 손잡이를 꾹 눌러서 위아래로 끌면 순서를 바꿀 수 있어요</p>
              <div className="mt-2 rounded-xl p-3" style={{ backgroundColor: C.card, border: `1px solid ${C.line}` }}>
                {draft.ingredients.map((ing, idx) => (
                  <div
                    key={ing.id}
                    ref={(el) => (ingredientDrag.itemRefs.current[idx] = el)}
                    className="flex items-center gap-2 py-1.5"
                    style={{
                      borderBottom: `1px dashed ${C.line}`,
                      backgroundColor: ingredientDrag.dragActiveIndex === idx ? C.raised : "transparent",
                      transform: ingredientDrag.dragActiveIndex === idx ? `translateY(${ingredientDrag.dragOffsetY}px) scale(1.02)` : "translateY(0)",
                      transition: ingredientDrag.dragActiveIndex === idx ? "none" : "transform 150ms ease",
                      zIndex: ingredientDrag.dragActiveIndex === idx ? 10 : 1,
                      position: "relative",
                      boxShadow: ingredientDrag.dragActiveIndex === idx ? "0 6px 16px #00000066" : "none",
                    }}
                  >
                    <button
                      onPointerDown={(e) => ingredientDrag.handleDragStart(e, idx)}
                      onTouchStart={(e) => ingredientDrag.handleDragStart(e, idx)}
                      className="shrink-0 touch-none cursor-grab active:cursor-grabbing"
                      style={{ color: C.muted, padding: "2px" }}
                    >
                      <GripVertical size={16} />
                    </button>
                    <input
                      value={ing.name}
                      onChange={(e) => updateIngredient(ing.id, { name: e.target.value })}
                      placeholder="재료명"
                      className="flex-1 bg-transparent text-sm"
                      style={{ color: C.paper }}
                    />
                    <input
                      value={ing.amount}
                      onChange={(e) => updateIngredient(ing.id, { amount: e.target.value })}
                      placeholder="양"
                      className="w-20 bg-transparent text-sm text-right"
                      style={{ color: C.turmeric, fontFamily: "'Gaegu', cursive", fontWeight: 700 }}
                    />
                    <button onClick={() => removeIngredientRow(ing.id)} style={{ color: C.muted }}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label style={{ color: C.muted, fontSize: 14 }}>조리 순서</label>
                <button onClick={addStepRow} style={{ color: C.turmeric, fontSize: 15 }} className="flex items-center gap-1">
                  <Plus size={14} /> 순서 추가
                </button>
              </div>
              <p style={{ color: C.muted, fontSize: 13, marginTop: 2 }}>≡ 손잡이를 꾹 눌러서 위아래로 끌면 순서를 바꿀 수 있어요</p>
              <div className="flex flex-col gap-2 mt-2">
                {draft.steps.map((s, idx) => (
                  <div
                    key={idx}
                    ref={(el) => (stepDrag.itemRefs.current[idx] = el)}
                    className="flex items-start gap-2 rounded-lg"
                    style={{
                      transform: stepDrag.dragActiveIndex === idx ? `translateY(${stepDrag.dragOffsetY}px) scale(1.02)` : "translateY(0)",
                      transition: stepDrag.dragActiveIndex === idx ? "none" : "transform 150ms ease",
                      zIndex: stepDrag.dragActiveIndex === idx ? 10 : 1,
                      position: "relative",
                      boxShadow: stepDrag.dragActiveIndex === idx ? "0 6px 16px #00000066" : "none",
                    }}
                  >
                    <button
                      onPointerDown={(e) => stepDrag.handleDragStart(e, idx)}
                      onTouchStart={(e) => stepDrag.handleDragStart(e, idx)}
                      className="mt-1 shrink-0 touch-none cursor-grab active:cursor-grabbing"
                      style={{ color: C.muted, padding: "4px 2px" }}
                    >
                      <GripVertical size={16} />
                    </button>
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-1 text-xs font-bold"
                      style={{ backgroundColor: C.ember, color: C.paper, fontFamily: "'Jua', sans-serif" }}
                    >
                      {idx + 1}
                    </div>
                    <textarea
                      value={s}
                      onChange={(e) => updateStep(idx, e.target.value)}
                      rows={2}
                      className="flex-1 px-3 py-2 rounded-lg text-sm"
                      style={{ backgroundColor: C.card, color: C.paper, border: `1px solid ${C.line}` }}
                    />
                    <button onClick={() => removeStepRow(idx)} style={{ color: C.muted }} className="mt-1">
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={saveDraft}
              disabled={!draft.title.trim()}
              className="w-full py-3.5 rounded-xl font-bold mt-2 mb-6"
              style={{ backgroundColor: draft.title.trim() ? C.ember : C.raised, color: C.paper, opacity: draft.title.trim() ? 1 : 0.6 }}
            >
              {isEditingExisting ? "수정 완료" : "쿡마크에 담기"}
            </button>
          </div>
        </div>
      )}

      {/* ---------- DETAIL ---------- */}
      {view === "detail" && selectedRecipe && (
        <div className="flex flex-col flex-1 pb-24">
          <div className="flex items-center justify-between px-4 py-4">
            <button onClick={() => setView("home")}><ChevronLeft size={24} color={C.paper} /></button>
            <div className="flex items-center gap-4">
              <button
                onClick={() => openEditExisting(selectedRecipe)}
                className="flex items-center gap-1 text-sm"
                style={{ color: C.turmeric, fontWeight: 700 }}
              >
                <PencilLine size={16} /> 수정하기
              </button>
              <button onClick={() => setConfirmDeleteId(selectedRecipe.id)} style={{ color: C.muted }}>
                <Trash2 size={18} />
              </button>
            </div>
          </div>
          <div className="px-5">
            {selectedRecipe.photos && selectedRecipe.photos.length > 0 ? (
              <div className="relative rounded-2xl overflow-hidden">
                <div className="flex gap-2 overflow-x-auto snap-x snap-mandatory" style={{ height: 200 }}>
                  {selectedRecipe.photos.map((p, idx) => (
                    <img
                      key={idx}
                      src={p}
                      alt={`${selectedRecipe.title} 사진 ${idx + 1}`}
                      className="w-full h-full object-cover rounded-2xl shrink-0 snap-center"
                    />
                  ))}
                </div>
                {selectedRecipe.photos.length > 1 && (
                  <span
                    className="absolute bottom-2 right-2 text-xs px-2 py-0.5 rounded-full"
                    style={{ backgroundColor: "#000000aa", color: C.paper }}
                  >
                    사진 {selectedRecipe.photos.length}장 · 옆으로 넘겨보기
                  </span>
                )}
                <div
                  className="absolute top-2 left-2 w-9 h-9 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: "#000000aa", fontSize: 18 }}
                >
                  {CATEGORY_EMOJI[selectedRecipe.category]}
                </div>
              </div>
            ) : (
              <div style={{ fontSize: 38 }}>{CATEGORY_EMOJI[selectedRecipe.category]}</div>
            )}
            <h2 style={{ fontFamily: "'Jua', sans-serif", fontSize: 26, marginTop: 6 }}>{selectedRecipe.title}</h2>
            <button
              onClick={() => setShowMoveFolder(true)}
              className="inline-flex items-center gap-1 mt-2 text-xs px-2 py-1 rounded-full"
              style={{ backgroundColor: C.emberSoft, color: C.ember, fontWeight: 700 }}
            >
              {selectedRecipe.folder} <PencilLine size={11} />
            </button>

            {selectedRecipe.note && selectedRecipe.note.trim() && (
              <div
                className="mt-4 p-3 rounded-xl text-sm leading-relaxed"
                style={{ backgroundColor: C.card, border: `1px solid ${C.line}`, color: C.paper, whiteSpace: "pre-wrap" }}
              >
                {linkify(selectedRecipe.note)}
              </div>
            )}

            <div className="mt-6">
              <div className="flex items-center justify-between">
                <h3 className="font-bold" style={{ color: C.paper }}>재료</h3>
                <button
                  onClick={() => addCheckedToShoppingList(selectedRecipe)}
                  className="flex items-center gap-1 text-sm px-3 py-1.5 rounded-full"
                  style={{ backgroundColor: C.scallion + "22", color: C.scallion, fontWeight: 700 }}
                >
                  <ShoppingCart size={14} /> 장보기 목록에 추가
                </button>
              </div>

              <div className="flex items-center gap-3 mt-3">
                <span style={{ color: C.muted, fontSize: 12 }}>인분수</span>
                <button
                  onClick={() => setViewServings((v) => Math.max(1, v - 1))}
                  className="w-8 h-8 rounded-full flex items-center justify-center font-bold"
                  style={{ backgroundColor: C.raised, color: C.paper }}
                >
                  −
                </button>
                <span style={{ color: C.paper, fontWeight: 700, minWidth: 48, textAlign: "center" }}>{viewServings}인분</span>
                <button
                  onClick={() => setViewServings((v) => v + 1)}
                  className="w-8 h-8 rounded-full flex items-center justify-center font-bold"
                  style={{ backgroundColor: C.raised, color: C.paper }}
                >
                  +
                </button>
                {viewServings !== (selectedRecipe.servings || 2) && (
                  <button onClick={() => setViewServings(selectedRecipe.servings || 2)} style={{ color: C.turmeric, fontSize: 12 }}>
                    원래대로
                  </button>
                )}
              </div>

              <div className="mt-2 rounded-xl p-3" style={{ backgroundColor: C.card, border: `1px solid ${C.line}` }}>
                {selectedRecipe.ingredients.map((ing) => (
                  <label key={ing.id} className="flex items-center gap-2 py-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!checkedIngredients[ing.id]}
                      onChange={(e) => setCheckedIngredients((prev) => ({ ...prev, [ing.id]: e.target.checked }))}
                    />
                    <div className="flex-1">
                      <ReceiptRow
                        name={ing.name}
                        amount={scaleAmount(ing.amount, viewServings / (selectedRecipe.servings || 2))}
                      />
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div className="mt-6 mb-10">
              <div className="flex items-center justify-between">
                <h3 className="font-bold" style={{ color: C.paper }}>조리 방법</h3>
                {selectedRecipe.steps.length > 0 && (
                  <button
                    onClick={startCooking}
                    className="flex items-center gap-1 text-sm px-3 py-1.5 rounded-full"
                    style={{ backgroundColor: C.ember, color: C.paper, fontWeight: 700 }}
                  >
                    <ChefHat size={14} /> 요리 시작
                  </button>
                )}
              </div>
              <div className="flex flex-col gap-3 mt-2">
                {selectedRecipe.steps.map((s, idx) => (
                  <div key={idx} className="flex items-start gap-3">
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 font-bold"
                      style={{ backgroundColor: C.ember, color: C.paper, fontFamily: "'Jua', sans-serif" }}
                    >
                      {idx + 1}
                    </div>
                    <p className="text-sm leading-relaxed pt-0.5" style={{ color: C.paper }}>{s}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ---------- COOKING MODE ---------- */}
      {view === "cooking" && selectedRecipe && (
        <div className="flex flex-col flex-1" style={{ minHeight: "100%" }}>
          <div className="flex items-center justify-between px-4 py-4">
            <button onClick={exitCooking}><X size={24} color={C.paper} /></button>
            <span style={{ color: C.muted, fontSize: 13, fontWeight: 700 }}>
              {cookingIndex + 1} / {selectedRecipe.steps.length}
            </span>
          </div>

          <div className="flex-1 flex flex-col justify-center px-6">
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center font-bold mb-4"
              style={{ backgroundColor: C.ember, color: C.paper, fontFamily: "'Jua', sans-serif" }}
            >
              {cookingIndex + 1}
            </div>
            <p style={{ color: C.paper, fontSize: 24, lineHeight: 1.5, fontWeight: 500 }}>
              {selectedRecipe.steps[cookingIndex]}
            </p>

            {timerSeconds != null && (
              <div className="mt-8 flex flex-col items-center gap-3 p-5 rounded-2xl" style={{ backgroundColor: C.card, border: `1px solid ${C.line}` }}>
                <span
                  style={{ color: timerSeconds === 0 ? C.scallion : C.turmeric, fontSize: 40, fontFamily: "'Gaegu', cursive", fontWeight: 700 }}
                >
                  {timerSeconds === 0 ? "완료!" : formatTime(timerSeconds)}
                </span>
                <div className="flex items-center gap-3">
                  {!timerRunning ? (
                    <button
                      onClick={startTimer}
                      disabled={timerSeconds === 0}
                      className="w-12 h-12 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: C.ember, color: C.paper, opacity: timerSeconds === 0 ? 0.5 : 1 }}
                    >
                      <Play size={20} />
                    </button>
                  ) : (
                    <button
                      onClick={pauseTimer}
                      className="w-12 h-12 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: C.ember, color: C.paper }}
                    >
                      <Pause size={20} />
                    </button>
                  )}
                  <button
                    onClick={resetTimer}
                    className="w-12 h-12 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: C.raised, color: C.muted }}
                  >
                    <RotateCcw size={18} />
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3 px-6 pb-10 pt-4">
            <button
              onClick={() => setCookingIndex((i) => Math.max(0, i - 1))}
              disabled={cookingIndex === 0}
              className="flex-1 py-4 rounded-xl font-bold flex items-center justify-center gap-1"
              style={{ backgroundColor: C.raised, color: C.paper, opacity: cookingIndex === 0 ? 0.4 : 1 }}
            >
              <ChevronLeft size={18} /> 이전
            </button>
            {cookingIndex < selectedRecipe.steps.length - 1 ? (
              <button
                onClick={() => setCookingIndex((i) => Math.min(selectedRecipe.steps.length - 1, i + 1))}
                className="flex-1 py-4 rounded-xl font-bold flex items-center justify-center gap-1"
                style={{ backgroundColor: C.ember, color: C.paper }}
              >
                다음 <ChevronRight size={18} />
              </button>
            ) : (
              <button
                onClick={exitCooking}
                className="flex-1 py-4 rounded-xl font-bold flex items-center justify-center gap-1"
                style={{ backgroundColor: C.scallion, color: C.ink }}
              >
                <Check size={18} /> 완성!
              </button>
            )}
          </div>
        </div>
      )}

      {view === "shopping" && (
        <div className="flex flex-col flex-1 pb-24">
          <div className="flex items-center gap-3 px-4 py-4">
            <button onClick={() => setView("home")}><ChevronLeft size={24} color={C.paper} /></button>
            <span className="font-bold" style={{ color: C.paper }}>장보기 목록</span>
          </div>
          <div className="px-5">
            {shoppingList.length === 0 ? (
              <div className="text-center py-16" style={{ color: C.muted }}>
                <div style={{ fontSize: 36 }}>🧺</div>
                <p className="mt-3 text-sm">레시피에서 재료를 담으면 여기에 모여요.</p>
              </div>
            ) : (
              <>
                <div className="flex justify-end mb-2">
                  <button
                    onClick={() => setShoppingList((prev) => prev.filter((i) => !i.checked))}
                    style={{ color: C.muted, fontSize: 13 }}
                  >
                    담은 항목 정리
                  </button>
                </div>
                <div className="rounded-xl p-3" style={{ backgroundColor: C.card, border: `1px solid ${C.line}` }}>
                  {shoppingList.map((item) => (
                    <label key={item.id} className="flex items-center gap-2 py-2" style={{ borderBottom: `1px dashed ${C.line}` }}>
                      <input
                        type="checkbox"
                        checked={item.checked}
                        onChange={(e) =>
                          setShoppingList((prev) => prev.map((i) => (i.id === item.id ? { ...i, checked: e.target.checked } : i)))
                        }
                      />
                      <div className="flex-1">
                        <div style={{ textDecoration: item.checked ? "line-through" : "none", opacity: item.checked ? 0.5 : 1 }}>
                          <ReceiptRow name={item.name} amount={item.amount} />
                        </div>
                        <span style={{ color: C.muted, fontSize: 11 }}>{(item.recipeTitles || []).join(", ")}</span>
                      </div>
                      <button onClick={() => setShoppingList((prev) => prev.filter((i) => i.id !== item.id))} style={{ color: C.muted }}>
                        <X size={14} />
                      </button>
                    </label>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ---------- FEATURE SUGGESTIONS (공유 데이터) ---------- */}
      {view === "features" && (
        <div className="flex flex-col flex-1 pb-10">
          <div className="flex items-center gap-3 px-4 py-4">
            <button onClick={() => setView("home")}><ChevronLeft size={24} color={C.paper} /></button>
            <span className="font-bold" style={{ color: C.paper }}>기능 제안</span>
          </div>

          <div className="px-5">
            <p style={{ color: C.muted, fontSize: 12, lineHeight: 1.5 }}>
              이 링크를 쓰는 모두에게 보이는 공간이에요. 원하는 기능을 적거나, 마음에 드는 제안에 투표해보세요.
            </p>

            <div className="flex gap-2 mt-3">
              <input
                value={newSuggestionText}
                onChange={(e) => setNewSuggestionText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addSuggestion()}
                placeholder="예: 재료로 레시피 검색하기"
                className="flex-1 px-3 py-2.5 rounded-xl text-sm"
                style={{ backgroundColor: C.card, color: C.paper, border: `1px solid ${C.line}` }}
              />
              <button
                onClick={addSuggestion}
                disabled={!newSuggestionText.trim()}
                className="px-4 rounded-xl font-bold"
                style={{ backgroundColor: C.ember, color: C.paper, opacity: newSuggestionText.trim() ? 1 : 0.5 }}
              >
                제안
              </button>
            </div>

            <div className="flex gap-2 mt-4">
              <Chip active={suggestionSort === "votes"} onClick={() => setSuggestionSort("votes")}>
                <span className="flex items-center gap-1"><Flame size={13} /> 인기</span>
              </Chip>
              <Chip active={suggestionSort === "recent"} onClick={() => setSuggestionSort("recent")}>
                <span className="flex items-center gap-1"><Sparkles size={13} /> 최신</span>
              </Chip>
            </div>

            <div className="flex flex-col gap-2 mt-3">
              {suggestions.length === 0 && (
                <div className="text-center py-16" style={{ color: C.muted }}>
                  <div style={{ fontSize: 36 }}>💡</div>
                  <p className="mt-3 text-sm">아직 제안이 없어요. 첫 제안을 남겨보세요.</p>
                </div>
              )}
              {[...suggestions]
                .sort((a, b) => (suggestionSort === "votes" ? b.votes - a.votes : b.createdAt - a.createdAt))
                .map((s) => {
                  const voted = votedIds.includes(s.id);
                  return (
                    <div
                      key={s.id}
                      className="flex items-center gap-3 p-3 rounded-2xl"
                      style={{ backgroundColor: C.card, border: `1px solid ${C.line}` }}
                    >
                      <button
                        onClick={() => toggleVote(s.id)}
                        className="flex flex-col items-center justify-center rounded-xl shrink-0"
                        style={{
                          width: 48,
                          height: 48,
                          backgroundColor: voted ? C.ember : C.raised,
                          color: voted ? C.paper : C.muted,
                        }}
                      >
                        <ArrowBigUp size={18} fill={voted ? "#fff" : "none"} />
                        <span style={{ fontSize: 12, fontWeight: 700 }}>{s.votes}</span>
                      </button>
                      <p className="flex-1 text-sm" style={{ color: C.paper }}>{s.text}</p>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      )}

      {/* ---------- BOTTOM NAV ---------- */}
      {(view === "home" || view === "shopping" || view === "detail") && (
        <div
          className="fixed bottom-0 left-0 right-0 max-w-md mx-auto flex items-center justify-around py-3 px-6"
          style={{ backgroundColor: C.card, borderTop: `1px solid ${C.line}` }}
        >
          <button onClick={() => setView("home")} className="flex flex-col items-center gap-1" style={{ color: view === "home" ? C.ember : C.muted }}>
            <BookOpen size={22} />
            <span className="text-xs">서랍</span>
          </button>
          <button
            onClick={() => setShowAddSheet(true)}
            className="w-14 h-14 rounded-full flex items-center justify-center -mt-8 shadow-lg"
            style={{ backgroundColor: C.ember, color: C.paper }}
          >
            <Plus size={26} />
          </button>
          <button onClick={() => setView("shopping")} className="flex flex-col items-center gap-1" style={{ color: view === "shopping" ? C.ember : C.muted }}>
            <ShoppingCart size={22} />
            <span className="text-xs">장보기</span>
          </button>
        </div>
      )}

      {/* ---------- ADD SHEET ---------- */}
      {showAddSheet && (
        <div className="fixed inset-0 flex items-end justify-center max-w-md mx-auto z-20" style={{ backgroundColor: "#00000099" }}>
          <div className="w-full rounded-t-3xl p-5" style={{ backgroundColor: C.ink, border: `1px solid ${C.line}` }}>
            <div className="flex items-center justify-between mb-4">
              <h3 style={{ fontFamily: "'Jua', sans-serif", fontSize: 22 }}>레시피 담기</h3>
              <button onClick={() => { setShowAddSheet(false); setShowTextBox(false); setLoadError(""); }}><X size={22} color={C.muted} /></button>
            </div>

            {!showTextBox ? (
              <div className="flex flex-col gap-3">
                <button
                  onClick={() => { setShowTextBox(true); setLoadError(""); }}
                  className="flex items-center gap-3 p-3 rounded-2xl text-left"
                  style={{ backgroundColor: C.card, border: `1px solid ${C.line}` }}
                >
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ backgroundColor: "#3B6FE0" }}>
                    <PencilLine size={20} color="#fff" />
                  </div>
                  <div>
                    <div className="font-bold">직접입력하기</div>
                    <div style={{ color: C.muted, fontSize: 12 }}>
                      기억나는 대로, 또는 댓글·캡션 텍스트를 그대로 적으면 AI가 재료·순서로 자동 정리해요
                    </div>
                  </div>
                </button>

                <label
                  htmlFor="recipe-photo-upload"
                  className="flex items-center gap-3 p-3 rounded-2xl text-left cursor-pointer"
                  style={{ backgroundColor: C.card, border: `1px solid ${C.line}` }}
                >
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ backgroundColor: "#D6437E" }}>
                    <Camera size={20} color="#fff" />
                  </div>
                  <div>
                    <div className="font-bold">사진에서 가져오기</div>
                    <div style={{ color: C.muted, fontSize: 12 }}>
                      레시피 스크린샷을 올리면 AI가 읽어서 자동 정리해요 (여러 장 한번에 선택 가능)
                    </div>
                  </div>
                </label>
                <input
                  id="recipe-photo-upload"
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={handlePhotoPick}
                />
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <p style={{ color: C.muted, fontSize: 12, lineHeight: 1.5 }}>
                  기억나는 재료·순서를 편한 순서로 적어도 되고, <b style={{ color: C.turmeric }}>댓글·캡션 텍스트</b>를
                  그대로 붙여넣어도 돼요. AI가 알아서 항목별로 정리해요. (링크만 달랑 넣으면 읽을 내용이 없어서 정리가 안 돼요)
                </p>
                <textarea
                  autoFocus
                  value={textInput}
                  onChange={(e) => { setTextInput(e.target.value); if (loadError) setLoadError(""); }}
                  placeholder={"예)\n닭다리살 700g, 소금 3꼬집, 대파 1개...\n1. 닭다리살을 한입 크기로 썬다\n2. 후라이팬에 구운 뒤 양념을 넣는다..."}
                  rows={7}
                  className="w-full p-3 rounded-xl text-sm"
                  style={{ backgroundColor: C.card, color: C.paper, border: `1px solid ${loadError ? C.ember : C.line}` }}
                />
                {loadError && (
                  <div className="px-3 py-2 rounded-lg text-sm" style={{ backgroundColor: C.emberSoft, color: C.ember }}>
                    {loadError}
                  </div>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={() => { setShowTextBox(false); setLoadError(""); }}
                    className="flex-1 py-3 rounded-xl font-bold"
                    style={{ backgroundColor: C.raised, color: C.muted }}
                  >
                    뒤로
                  </button>
                  <button
                    onClick={handleTextSubmit}
                    disabled={!textInput.trim()}
                    className="flex-1 py-3 rounded-xl font-bold"
                    style={{ backgroundColor: C.ember, color: C.paper, opacity: textInput.trim() ? 1 : 0.5 }}
                  >
                    AI로 정리하기
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ---------- DELETE CONFIRM ---------- */}
      {confirmDeleteId && (
        <div className="fixed inset-0 flex items-center justify-center max-w-md mx-auto z-40 px-6" style={{ backgroundColor: "#000000cc" }}>
          <div className="w-full rounded-2xl p-5" style={{ backgroundColor: C.card, border: `1px solid ${C.line}` }}>
            <h3 style={{ fontFamily: "'Jua', sans-serif", fontSize: 20, color: C.paper }}>레시피를 삭제할까요?</h3>
            <p style={{ color: C.muted, fontSize: 13, marginTop: 6 }}>삭제하면 다시 되돌릴 수 없어요.</p>
            <div className="flex gap-2 mt-5">
              <button
                onClick={() => setConfirmDeleteId(null)}
                className="flex-1 py-3 rounded-xl font-bold"
                style={{ backgroundColor: C.raised, color: C.muted }}
              >
                취소
              </button>
              <button
                onClick={() => { deleteRecipe(confirmDeleteId); setConfirmDeleteId(null); }}
                className="flex-1 py-3 rounded-xl font-bold"
                style={{ backgroundColor: C.ember, color: C.paper }}
              >
                삭제하기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------- MOVE TO FOLDER SHEET ---------- */}
      {showMoveFolder && selectedRecipe && (
        <div className="fixed inset-0 flex items-end justify-center max-w-md mx-auto z-20" style={{ backgroundColor: "#00000099" }}>
          <div className="w-full rounded-t-3xl p-5" style={{ backgroundColor: C.ink, border: `1px solid ${C.line}` }}>
            <div className="flex items-center justify-between mb-4">
              <h3 style={{ fontFamily: "'Jua', sans-serif", fontSize: 22 }}>폴더 옮기기</h3>
              <button onClick={() => setShowMoveFolder(false)}><X size={22} color={C.muted} /></button>
            </div>
            <div className="flex flex-col gap-2 max-h-80 overflow-y-auto">
              {folders.map((f) => {
                const active = f === selectedRecipe.folder;
                return (
                  <button
                    key={f}
                    onClick={() => moveRecipeToFolder(selectedRecipe.id, f)}
                    className="flex items-center justify-between px-3 py-2.5 rounded-xl text-left"
                    style={{ backgroundColor: active ? C.emberSoft : C.card, border: `1px solid ${active ? C.ember : C.line}` }}
                  >
                    <span style={{ color: C.paper, fontWeight: 700 }}>{f}</span>
                    {active && <Check size={16} color={C.ember} />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ---------- FOLDER MANAGE SHEET ---------- */}
      {showFolderManage && (
        <div className="fixed inset-0 flex items-end justify-center max-w-md mx-auto z-20" style={{ backgroundColor: "#00000099" }}>
          <div className="w-full rounded-t-3xl p-5" style={{ backgroundColor: C.ink, border: `1px solid ${C.line}` }}>
            <div className="flex items-center justify-between mb-4">
              <h3 style={{ fontFamily: "'Jua', sans-serif", fontSize: 22 }}>폴더 관리</h3>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-0.5 rounded-full p-0.5" style={{ backgroundColor: C.card, border: `1px solid ${C.line}` }}>
                  <button
                    onClick={() => setCardLayout("list")}
                    className="w-8 h-8 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: cardLayout === "list" ? C.ember : "transparent", color: cardLayout === "list" ? C.paper : C.muted }}
                    aria-label="리스트형 보기"
                  >
                    <List size={15} />
                  </button>
                  <button
                    onClick={() => setCardLayout("grid")}
                    className="w-8 h-8 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: cardLayout === "grid" ? C.ember : "transparent", color: cardLayout === "grid" ? C.paper : C.muted }}
                    aria-label="그리드형 보기"
                  >
                    <LayoutGrid size={15} />
                  </button>
                </div>
                <button onClick={() => setShowFolderManage(false)}><X size={22} color={C.muted} /></button>
              </div>
            </div>
            {folders.length === 0 ? (
              <p style={{ color: C.muted, fontSize: 13 }}>아직 만든 폴더가 없어요.</p>
            ) : (
              <div className="flex flex-col gap-2 max-h-80 overflow-y-auto">
                {folders.map((f) => (
                  <div
                    key={f}
                    className="flex items-center justify-between px-3 py-2.5 rounded-xl"
                    style={{ backgroundColor: C.card, border: `1px solid ${C.line}` }}
                  >
                    <span style={{ color: C.paper, fontWeight: 700 }}>{f}</span>
                    <button onClick={() => setConfirmDeleteFolder(f)} style={{ color: C.muted }}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ---------- FOLDER DELETE CONFIRM ---------- */}
      {confirmDeleteFolder && (
        <div className="fixed inset-0 flex items-center justify-center max-w-md mx-auto z-40 px-6" style={{ backgroundColor: "#000000cc" }}>
          <div className="w-full rounded-2xl p-5" style={{ backgroundColor: C.card, border: `1px solid ${C.line}` }}>
            <h3 style={{ fontFamily: "'Jua', sans-serif", fontSize: 20, color: C.paper }}>
              "{confirmDeleteFolder}" 폴더를 삭제할까요?
            </h3>
            <p style={{ color: C.muted, fontSize: 13, marginTop: 6 }}>
              이 폴더의 레시피는 사라지지 않고 다른 폴더로 옮겨져요.
            </p>
            <div className="flex gap-2 mt-5">
              <button
                onClick={() => setConfirmDeleteFolder(null)}
                className="flex-1 py-3 rounded-xl font-bold"
                style={{ backgroundColor: C.raised, color: C.muted }}
              >
                취소
              </button>
              <button
                onClick={() => performDeleteFolder(confirmDeleteFolder)}
                className="flex-1 py-3 rounded-xl font-bold"
                style={{ backgroundColor: C.ember, color: C.paper }}
              >
                삭제하기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------- LOADING OVERLAY ---------- */}
      {loading && (
        <div className="fixed inset-0 flex flex-col items-center justify-center max-w-md mx-auto z-30" style={{ backgroundColor: "#000000cc" }}>
          <Loader2 size={32} className="animate-spin" color={C.turmeric} />
          <p className="mt-3 text-sm" style={{ color: C.paper }}>{loadingMsg}</p>
        </div>
      )}
    </div>
  );
}
