import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Camera, Plus, X, ChevronLeft, Check, ShoppingCart,
  Loader2, Trash2, Search, FolderPlus, PencilLine, GripVertical,
  List, LayoutGrid, Settings2, ChefHat, Play, Pause, RotateCcw, ChevronRight,
  Lightbulb, ArrowBigUp, Flame, Sparkles, LogOut, Home, User,
} from "lucide-react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc, setDoc, deleteDoc, collection, getDocs } from "firebase/firestore";
import { auth, db } from "./firebase";
import LoginScreen from "./LoginScreen";

const C = {
  ink: "#FFFFFF",
  card: "#F8F0E4",
  raised: "#F1E3EC",
  line: "#E6D6E0",
  ember: "#6B3F5C",
  emberSoft: "#6B3F5C20",
  turmeric: "#B9762C",
  scallion: "#5B8B5A",
  paper: "#3B2438",
  muted: "#8C7B6B",
};

const CATEGORIES = ["한식", "중식", "일식", "양식", "디저트", "기타"];
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

const COOKMARK_LOGO = "data:image/png;base64,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";

const uid = () => Math.random().toString(36).slice(2, 10);

// window.storage는 Claude 대화창(artifact) 안에서만 제공되는 저장소예요.
// Netlify/Replit처럼 독립 배포된 환경에서는 이게 없기 때문에,
// 없을 경우 Firestore를 사용해서 로그인한 계정별로 데이터를 저장합니다.
// shared=false 데이터는 users/{uid}/data/{key} 문서에, shared=true 데이터는
// shared/{key} 문서에 저장됩니다 (예: 기능 제안 게시판처럼 모두가 보는 데이터).
let appStorageUid = null;
function setAppStorageUid(uid) {
  appStorageUid = uid || null;
}

const appStorage = (() => {
  if (typeof window !== "undefined" && window.storage && typeof window.storage.get === "function") {
    return window.storage;
  }
  const docRef = (key, shared) =>
    shared ? doc(db, "shared", key) : doc(db, "users", appStorageUid, "data", key);
  return {
    async get(key, shared = false) {
      try {
        if (!shared && !appStorageUid) return null;
        const snap = await getDoc(docRef(key, shared));
        if (!snap.exists()) return null;
        const data = snap.data();
        return { key, value: data.value, shared };
      } catch (e) {
        return null;
      }
    },
    async set(key, value, shared = false) {
      try {
        if (!shared && !appStorageUid) return null;
        await setDoc(docRef(key, shared), { value, updatedAt: Date.now() });
        return { key, value, shared };
      } catch (e) {
        return null;
      }
    },
    async delete(key, shared = false) {
      try {
        if (!shared && !appStorageUid) return null;
        await deleteDoc(docRef(key, shared));
        return { key, deleted: true, shared };
      } catch (e) {
        return null;
      }
    },
    async list(prefix = "", shared = false) {
      try {
        if (!shared && !appStorageUid) return { keys: [], prefix, shared };
        const colRef = shared ? collection(db, "shared") : collection(db, "users", appStorageUid, "data");
        const snaps = await getDocs(colRef);
        const keys = [];
        snaps.forEach((d) => {
          if (d.id.startsWith(prefix)) keys.push(d.id);
        });
        return { keys, prefix, shared };
      } catch (e) {
        return null;
      }
    },
  };
})();

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

async function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result.split(",")[1]);
    r.onerror = () => reject(new Error("read fail"));
    r.readAsDataURL(file);
  });
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
  if (data.error) {
    throw new Error(data.error);
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
        color: active ? C.ink : C.muted,
        border: `1px solid ${active ? C.ember : C.line}`,
        fontFamily: "'Gowun Dodum', sans-serif",
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
      <span style={{ color: C.paper, fontFamily: "'Gowun Dodum', sans-serif" }}>{name}</span>
      <span className="flex-1" style={{ borderBottom: `1px dotted ${C.line}`, transform: "translateY(-3px)" }} />
      <span style={{ color: C.turmeric, fontFamily: mono ? "'IBM Plex Mono', monospace" : "inherit", fontWeight: 600, fontSize: 14 }}>
        {amount}
      </span>
    </div>
  );
}

export default function RecipeKeeper() {
  // ---- 로그인 상태 (undefined: 확인 중, null: 로그아웃, 객체: 로그인됨) ----
  const [user, setUser] = useState(undefined);
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsub();
  }, []);

  const [view, setView] = useState("home");
  const [recipes, setRecipes] = useState([]);
  const [folders, setFolders] = useState(DEFAULT_FOLDERS);
  const [activeFolder, setActiveFolder] = useState("전체");
  const [categories, setCategories] = useState(CATEGORIES);
  const [activeCategory, setActiveCategory] = useState("전체");
  const [shoppingList, setShoppingList] = useState([]);
  const [cartAddedFlash, setCartAddedFlash] = useState(false);
  const [manualItemName, setManualItemName] = useState("");
  const [manualItemAmount, setManualItemAmount] = useState("");

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
  const [showCategoryManage, setShowCategoryManage] = useState(false);
  const [confirmDeleteCategory, setConfirmDeleteCategory] = useState(null);
  // 등록/수정 화면에서 카테고리·폴더를 바로 추가할 때 쓰는 입력창 상태
  const [editCategoryAddOpen, setEditCategoryAddOpen] = useState(false);
  const [editNewCategoryName, setEditNewCategoryName] = useState("");
  const [editFolderAddOpen, setEditFolderAddOpen] = useState(false);
  const [editNewFolderName, setEditNewFolderName] = useState("");

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
  const [recentSearches, setRecentSearches] = useState([]);
  const [cardLayout, setCardLayout] = useState("list"); // "list" | "grid"
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [newCategoryOpen, setNewCategoryOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [checkedIngredients, setCheckedIngredients] = useState({});
  const [viewServings, setViewServings] = useState(2);
  const [ready, setReady] = useState(false);
  const fileInputRef = useRef(null);
  const searchInputRef = useRef(null);

  useEffect(() => {
    if (!user) return; // 로그인 확인 전이거나 로그아웃 상태면 아직 불러오지 않음
    setAppStorageUid(user.uid);
    setReady(false);
    (async () => {
      try {
        const r = await appStorage.get("recipes", false);
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
        const f = await appStorage.get("folders", false);
        if (f && f.value) setFolders(JSON.parse(f.value));
      } catch (e) {}
      try {
        const cg = await appStorage.get("categories", false);
        if (cg && cg.value) {
          const parsed = JSON.parse(cg.value);
          if (Array.isArray(parsed) && parsed.length) setCategories(parsed);
        }
      } catch (e) {}
      try {
        const l = await appStorage.get("cardLayout", false);
        if (l && l.value) setCardLayout(l.value === "grid" ? "grid" : "list");
      } catch (e) {}
      try {
        const fs = await appStorage.get("featureSuggestions", true);
        if (fs && fs.value) setSuggestions(JSON.parse(fs.value));
      } catch (e) {}
      try {
        const vi = await appStorage.get("votedSuggestionIds", false);
        if (vi && vi.value) setVotedIds(JSON.parse(vi.value));
      } catch (e) {}
      try {
        const s = await appStorage.get("shoppingList", false);
        if (s && s.value) {
          const parsed = JSON.parse(s.value);
          const migrated = parsed.map((item) =>
            item.recipeTitles ? item : { ...item, recipeTitles: item.recipeTitle ? [item.recipeTitle] : [] }
          );
          setShoppingList(migrated);
        }
      } catch (e) {}
      try {
        const rs = await appStorage.get("recentSearches", false);
        if (rs && rs.value) setRecentSearches(JSON.parse(rs.value));
      } catch (e) {}
      setReady(true);
    })();
  }, [user]);

  useEffect(() => { if (ready) appStorage.set("recipes", JSON.stringify(recipes), false).catch(() => {}); }, [recipes, ready]);
  useEffect(() => { if (ready) appStorage.set("folders", JSON.stringify(folders), false).catch(() => {}); }, [folders, ready]);
  useEffect(() => { if (ready) appStorage.set("categories", JSON.stringify(categories), false).catch(() => {}); }, [categories, ready]);
  useEffect(() => { if (ready) appStorage.set("cardLayout", cardLayout, false).catch(() => {}); }, [cardLayout, ready]);
  useEffect(() => { if (ready) appStorage.set("featureSuggestions", JSON.stringify(suggestions), true).catch(() => {}); }, [suggestions, ready]);
  useEffect(() => { if (ready) appStorage.set("votedSuggestionIds", JSON.stringify(votedIds), false).catch(() => {}); }, [votedIds, ready]);
  useEffect(() => { if (ready) appStorage.set("recentSearches", JSON.stringify(recentSearches), false).catch(() => {}); }, [recentSearches, ready]);

  function addRecentSearch(term) {
    const t = (term || "").trim();
    if (!t) return;
    setRecentSearches((prev) => [t, ...prev.filter((s) => s !== t)].slice(0, 10));
  }
  function removeRecentSearch(term) {
    setRecentSearches((prev) => prev.filter((s) => s !== term));
  }
  function clearRecentSearches() {
    setRecentSearches([]);
  }

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
  useEffect(() => { if (ready) appStorage.set("shoppingList", JSON.stringify(shoppingList), false).catch(() => {}); }, [shoppingList, ready]);
  useEffect(() => {
    if (!cartAddedFlash) return;
    const t = setTimeout(() => setCartAddedFlash(false), 1600);
    return () => clearTimeout(t);
  }, [cartAddedFlash]);

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
        files.map(async (file) => ({
          type: "image",
          source: { type: "base64", media_type: file.type || "image/jpeg", data: await fileToBase64(file) },
        }))
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

  const reorderFoldersCb = useCallback((from, to) => {
    setFolders((prev) => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }, []);
  const folderDrag = useReorderList(reorderFoldersCb);

  const reorderCategoriesCb = useCallback((from, to) => {
    setCategories((prev) => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }, []);
  const categoryDrag = useReorderList(reorderCategoriesCb);

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
    if (!categories.includes(clean.category)) setCategories((prev) => [...prev, clean.category]);
    const wasEditing = isEditingExisting;
    setDraft(null);
    setIsEditingExisting(false);
    if (wasEditing) {
      setSelectedId(clean.id);
      setView("detail");
    } else {
      setActiveFolder("전체");
      setActiveCategory("전체");
      setSearch("");
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

  function addCategoryFilter() {
    const name = newCategoryName.trim();
    if (!name) return;
    if (!categories.includes(name)) setCategories((prev) => [...prev, name]);
    setActiveCategory(name);
    setNewCategoryName("");
    setNewCategoryOpen(false);
  }

  function addCategory() {
    const name = editNewCategoryName.trim();
    if (!name) return;
    if (!categories.includes(name)) setCategories((prev) => [...prev, name]);
    if (draft) updateDraft({ category: name });
    setEditNewCategoryName("");
    setEditCategoryAddOpen(false);
  }

  function addFolderInline() {
    const name = editNewFolderName.trim();
    if (!name) return;
    if (!folders.includes(name)) setFolders((prev) => [...prev, name]);
    if (draft) updateDraft({ folder: name });
    setEditNewFolderName("");
    setEditFolderAddOpen(false);
  }

  function performDeleteCategory(name) {
    const remaining = categories.filter((c) => c !== name);
    const fallback = remaining[0] || "기타";
    setCategories(remaining.length ? remaining : ["기타"]);
    setRecipes((prev) => prev.map((r) => (r.category === name ? { ...r, category: fallback } : r)));
    if (activeCategory === name) setActiveCategory("전체");
    setConfirmDeleteCategory(null);
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
    setRecipes((prev) => prev.map((rec) => (rec.id === id ? { ...rec, viewCount: (rec.viewCount || 0) + 1 } : rec)));
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
    setCartAddedFlash(true);
  }

  function addManualCartItem() {
    const name = manualItemName.trim();
    if (!name) return;
    setShoppingList((prev) => [
      { id: uid(), name, amount: manualItemAmount.trim(), checked: false, recipeTitles: [] },
      ...prev,
    ]);
    setManualItemName("");
    setManualItemAmount("");
  }

  // 같은 이름(공백 무시, 대소문자 무시)의 항목을 하나로 합쳐요.
  function mergeDuplicateShoppingItems() {
    setShoppingList((prev) => {
      const merged = [];
      prev.forEach((item) => {
        const idx = merged.findIndex(
          (m) => !!m.checked === !!item.checked && m.name.trim().toLowerCase() === item.name.trim().toLowerCase()
        );
        if (idx >= 0) {
          merged[idx] = {
            ...merged[idx],
            amount: mergeAmount(merged[idx].amount, item.amount),
            recipeTitles: Array.from(new Set([...(merged[idx].recipeTitles || []), ...(item.recipeTitles || [])])),
          };
        } else {
          merged.push({ ...item });
        }
      });
      return merged;
    });
  }

  const selectedRecipe = recipes.find((r) => r.id === selectedId);

  const visibleRecipes = recipes.filter((r) => {
    const matchesFolder = activeFolder === "전체" || r.folder === activeFolder;
    const matchesCategory = activeCategory === "전체" || r.category === activeCategory;
    const q = search.trim().toLowerCase();
    const matchesSearch =
      !q ||
      r.title.toLowerCase().includes(q) ||
      (r.ingredients || []).some((i) => i.name.toLowerCase().includes(q));
    return matchesFolder && matchesCategory && matchesSearch;
  });

  const searchQuery = search.trim().toLowerCase();
  const searchResults = searchQuery
    ? recipes.filter(
        (r) =>
          r.title.toLowerCase().includes(searchQuery) ||
          (r.ingredients || []).some((i) => i.name.toLowerCase().includes(searchQuery))
      )
    : [];
  const topViewedRecipes = [...recipes]
    .filter((r) => r.viewCount > 0)
    .sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0))
    .slice(0, 5);

  // ---- 로그인 확인 중 ----
  if (user === undefined) {
    return (
      <div
        style={{
          minHeight: "100vh",
          backgroundColor: C.ink,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Loader2 className="animate-spin" color={C.ember} size={32} />
      </div>
    );
  }

  // ---- 로그인 안 되어 있으면 로그인 화면 ----
  if (!user) {
    return <LoginScreen />;
  }

  return (
    <div
      style={{ backgroundColor: C.ink, minHeight: "100vh", color: C.paper, fontFamily: "'Gowun Dodum', sans-serif" }}
      className="w-full max-w-md mx-auto relative flex flex-col overflow-x-hidden"
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Gowun+Dodum&family=IBM+Plex+Mono:wght@500;600&display=swap');
        html, body, #root { background-color: ${C.ink}; margin: 0; min-height: 100%; overflow-x: hidden; }
        ::-webkit-scrollbar { display: none; }
        * { -ms-overflow-style: none; scrollbar-width: none; }
        input, textarea { outline: none; }
      `}</style>

      {/* ---------- HOME ---------- */}
      {view === "home" && (
        <div className="flex flex-col flex-1 pb-24">
          <div className="px-5 pt-6 pb-2 flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <img src={COOKMARK_LOGO} alt="쿡마크 로고" style={{ width: 40, height: 40, borderRadius: 10 }} />
                <h1 style={{ fontFamily: "'Gowun Dodum', sans-serif", fontSize: 30, fontWeight: 800, color: C.paper }}>Cookmark</h1>
              </div>
              <p style={{ color: C.muted, fontSize: 15, marginTop: 2, whiteSpace: "nowrap" }}>
                {recipes.length}개의 레시피를 모아뒀어요
              </p>
            </div>
            <div className="flex items-center gap-2 mt-1 shrink-0">
              <button
                onClick={() => setView("features")}
                className="flex items-center gap-1 px-2 py-1.5 rounded-full"
                style={{ backgroundColor: "#FFFFFF", border: `1px solid ${C.line}`, color: C.turmeric }}
              >
                <Lightbulb size={13} />
                <span style={{ fontSize: 12, fontWeight: 700 }}>기능 제안</span>
              </button>
            </div>
          </div>

          <div className="px-5 py-2 flex items-center gap-2 min-w-0">
            <div className="flex-1 min-w-0 flex items-center gap-2 px-3 py-2 rounded-xl" style={{ backgroundColor: C.card, border: `1px solid ${C.line}` }}>
              <Search size={16} color={C.muted} />
              <input
                ref={searchInputRef}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addRecentSearch(search)}
                placeholder="이름이나 재료로 찾기 (예: 대파)"
                className="bg-transparent flex-1 min-w-0 text-sm"
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

          <div className="flex items-center gap-2 px-5 py-3 overflow-x-auto min-w-0">
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

          <div className="flex items-center gap-2 px-5 pb-3 overflow-x-auto min-w-0">
            <Chip active={activeCategory === "전체"} onClick={() => setActiveCategory("전체")} style={{ fontSize: 13, padding: "4px 10px" }}>
              카테고리 전체
            </Chip>
            {categories.map((c) => (
              <Chip key={c} active={activeCategory === c} onClick={() => setActiveCategory(c)} style={{ fontSize: 13, padding: "4px 10px" }}>
                {c}
              </Chip>
            ))}
            {!newCategoryOpen ? (
              <Chip onClick={() => setNewCategoryOpen(true)} style={{ backgroundColor: "transparent", fontSize: 13, padding: "4px 10px" }}>
                <span className="flex items-center gap-1"><Plus size={13} /> 카테고리</span>
              </Chip>
            ) : (
              <div className="flex items-center gap-1 shrink-0">
                <input
                  autoFocus
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addCategoryFilter()}
                  placeholder="카테고리 이름"
                  className="px-2 py-1 rounded-full text-sm w-24"
                  style={{ backgroundColor: C.raised, color: C.paper, border: `1px solid ${C.line}` }}
                />
                <button onClick={addCategoryFilter} style={{ color: C.scallion }}><Check size={18} /></button>
                <button onClick={() => setNewCategoryOpen(false)} style={{ color: C.muted }}><X size={18} /></button>
              </div>
            )}
            <button
              onClick={() => setShowCategoryManage(true)}
              className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center"
              style={{ backgroundColor: C.raised, color: C.muted }}
              aria-label="카테고리 관리"
            >
              <Settings2 size={13} />
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
                      style={{ backgroundColor: C.raised }}
                    >
                      {r.photos && r.photos[0] ? (
                        <img src={r.photos[0]} alt={r.title} className="w-full h-full object-cover" />
                      ) : (
                        <ChefHat size={20} color={C.muted} />
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
                      style={{ height: 92, backgroundColor: C.raised }}
                    >
                      {r.photos && r.photos[0] ? (
                        <img src={r.photos[0]} alt={r.title} className="w-full h-full object-cover" />
                      ) : (
                        <ChefHat size={26} color={C.muted} />
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
              <div className="flex gap-2 mt-2 overflow-x-auto pb-1 min-w-0">
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
                        style={{ backgroundColor: C.ember, color: C.ink, fontSize: 12 }}
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
              <div className="flex gap-2 mt-1 overflow-x-auto min-w-0">
                {categories.map((c) => (
                  <Chip key={c} active={draft.category === c} onClick={() => updateDraft({ category: c })}>
                    {c}
                  </Chip>
                ))}
                {!editCategoryAddOpen ? (
                  <Chip onClick={() => setEditCategoryAddOpen(true)} style={{ backgroundColor: "transparent" }}>
                    <span className="flex items-center gap-1"><Plus size={14} /> 추가</span>
                  </Chip>
                ) : (
                  <div className="flex items-center gap-1 shrink-0">
                    <input
                      autoFocus
                      value={editNewCategoryName}
                      onChange={(e) => setEditNewCategoryName(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && addCategory()}
                      placeholder="카테고리 이름"
                      className="px-2 py-1 rounded-full text-sm w-24"
                      style={{ backgroundColor: C.raised, color: C.paper, border: `1px solid ${C.line}` }}
                    />
                    <button onClick={addCategory} style={{ color: C.scallion }}><Check size={18} /></button>
                    <button onClick={() => setEditCategoryAddOpen(false)} style={{ color: C.muted }}><X size={18} /></button>
                  </div>
                )}
              </div>
            </div>

            <div>
              <label style={{ color: C.muted, fontSize: 14 }}>폴더</label>
              <div className="flex gap-2 mt-1 overflow-x-auto min-w-0">
                {folders.map((f) => (
                  <Chip key={f} active={draft.folder === f} onClick={() => updateDraft({ folder: f })}>{f}</Chip>
                ))}
                {!editFolderAddOpen ? (
                  <Chip onClick={() => setEditFolderAddOpen(true)} style={{ backgroundColor: "transparent" }}>
                    <span className="flex items-center gap-1"><Plus size={14} /> 추가</span>
                  </Chip>
                ) : (
                  <div className="flex items-center gap-1 shrink-0">
                    <input
                      autoFocus
                      value={editNewFolderName}
                      onChange={(e) => setEditNewFolderName(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && addFolderInline()}
                      placeholder="폴더 이름"
                      className="px-2 py-1 rounded-full text-sm w-24"
                      style={{ backgroundColor: C.raised, color: C.paper, border: `1px solid ${C.line}` }}
                    />
                    <button onClick={addFolderInline} style={{ color: C.scallion }}><Check size={18} /></button>
                    <button onClick={() => setEditFolderAddOpen(false)} style={{ color: C.muted }}><X size={18} /></button>
                  </div>
                )}
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
                      className="flex-1 min-w-0 bg-transparent text-sm"
                      style={{ color: C.paper }}
                    />
                    <input
                      value={ing.amount}
                      onChange={(e) => updateIngredient(ing.id, { amount: e.target.value })}
                      placeholder="양"
                      className="w-20 shrink-0 bg-transparent text-sm text-right"
                      style={{ color: C.turmeric, fontFamily: "'IBM Plex Mono', monospace" }}
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
                      style={{ backgroundColor: C.ember, color: C.ink, fontFamily: "'Gowun Dodum', sans-serif" }}
                    >
                      {idx + 1}
                    </div>
                    <textarea
                      value={s}
                      onChange={(e) => updateStep(idx, e.target.value)}
                      rows={2}
                      className="flex-1 min-w-0 px-3 py-2 rounded-lg text-sm"
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
              {isEditingExisting ? "수정 완료" : "레시피 서랍에 담기"}
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
                <div className="flex gap-2 overflow-x-auto snap-x snap-mandatory min-w-0" style={{ height: 200 }}>
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
                  style={{ backgroundColor: "#000000aa" }}
                >
                  <ChefHat size={18} color="#fff" />
                </div>
              </div>
            ) : (
              <div style={{ color: C.muted }}><ChefHat size={34} /></div>
            )}
            <h2 style={{ fontFamily: "'Gowun Dodum', sans-serif", fontSize: 26, marginTop: 6 }}>{selectedRecipe.title}</h2>
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
                <div className="flex items-center gap-2">
                  {cartAddedFlash && (
                    <span style={{ color: C.scallion, fontSize: 13, fontWeight: 700 }}>담았어요 ✓</span>
                  )}
                  <button
                    onClick={() => addCheckedToShoppingList(selectedRecipe)}
                    className="flex items-center gap-1 text-sm px-3 py-1.5 rounded-full"
                    style={{ backgroundColor: C.scallion + "22", color: C.scallion, fontWeight: 700 }}
                  >
                    <ShoppingCart size={14} /> 장바구니에 추가
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-3 mt-3">
                <span style={{ color: C.muted, fontSize: 14 }}>인분수</span>
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
                  <button onClick={() => setViewServings(selectedRecipe.servings || 2)} style={{ color: C.turmeric, fontSize: 14 }}>
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
                    <div className="flex-1 min-w-0">
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
                    style={{ backgroundColor: C.ember, color: C.ink, fontWeight: 700 }}
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
                      style={{ backgroundColor: C.ember, color: C.ink, fontFamily: "'Gowun Dodum', sans-serif" }}
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
            <span style={{ color: C.muted, fontSize: 15, fontWeight: 700 }}>
              {cookingIndex + 1} / {selectedRecipe.steps.length}
            </span>
          </div>

          <div className="flex-1 flex flex-col justify-center px-6">
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center font-bold mb-4"
              style={{ backgroundColor: C.ember, color: C.ink, fontFamily: "'Gowun Dodum', sans-serif" }}
            >
              {cookingIndex + 1}
            </div>
            <p style={{ color: C.paper, fontSize: 24, lineHeight: 1.5, fontWeight: 500 }}>
              {selectedRecipe.steps[cookingIndex]}
            </p>

            {timerSeconds != null && (
              <div className="mt-8 flex flex-col items-center gap-3 p-5 rounded-2xl" style={{ backgroundColor: C.card, border: `1px solid ${C.line}` }}>
                <span
                  style={{ color: timerSeconds === 0 ? C.scallion : C.turmeric, fontSize: 40, fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600 }}
                >
                  {timerSeconds === 0 ? "완료!" : formatTime(timerSeconds)}
                </span>
                <div className="flex items-center gap-3">
                  {!timerRunning ? (
                    <button
                      onClick={startTimer}
                      disabled={timerSeconds === 0}
                      className="w-12 h-12 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: C.ember, color: C.ink, opacity: timerSeconds === 0 ? 0.5 : 1 }}
                    >
                      <Play size={20} />
                    </button>
                  ) : (
                    <button
                      onClick={pauseTimer}
                      className="w-12 h-12 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: C.ember, color: C.ink }}
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
                style={{ backgroundColor: C.ember, color: C.ink }}
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
            <span className="font-bold" style={{ color: C.paper }}>장바구니</span>
          </div>
          <div className="px-5">
            {shoppingList.length === 0 ? (
              <div className="text-center py-16" style={{ color: C.muted }}>
                <div style={{ fontSize: 36 }}>🧺</div>
                <p className="mt-3 text-sm">레시피에서 재료를 담으면 여기에 모여요.</p>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2 mb-2">
                  <button
                    onClick={mergeDuplicateShoppingItems}
                    className="px-3 py-1.5 rounded-xl text-sm"
                    style={{ backgroundColor: C.emberSoft, color: C.ember, fontWeight: 700 }}
                  >
                    자동정리
                  </button>
                  <button
                    onClick={() => setView("cartEdit")}
                    className="px-3 py-1.5 rounded-xl text-sm"
                    style={{ backgroundColor: C.raised, color: C.muted, fontWeight: 700 }}
                  >
                    담은 항목 정리
                  </button>
                </div>
                <p style={{ color: C.muted, fontSize: 12, marginBottom: 8 }}>
                  이름이 같은 재료는 "자동정리"로 합쳐져요. 이름 수정이나 삭제는 "담은 항목 정리"에서 할 수 있어요.
                </p>
                <div className="rounded-xl p-3" style={{ backgroundColor: C.card, border: `1px solid ${C.line}` }}>
                  {shoppingList.map((item) => (
                    <div key={item.id} className="flex items-center gap-2 py-2" style={{ borderBottom: `1px dashed ${C.line}` }}>
                      <input
                        type="checkbox"
                        checked={item.checked}
                        onChange={(e) =>
                          setShoppingList((prev) => prev.map((i) => (i.id === item.id ? { ...i, checked: e.target.checked } : i)))
                        }
                      />
                      <div className="flex-1 min-w-0">
                        <div style={{ textDecoration: item.checked ? "line-through" : "none", opacity: item.checked ? 0.5 : 1 }}>
                          <ReceiptRow name={item.name} amount={item.amount} />
                        </div>
                        <span style={{ color: C.muted, fontSize: 13 }}>{(item.recipeTitles || []).join(", ")}</span>
                      </div>
                      <button onClick={() => setShoppingList((prev) => prev.filter((i) => i.id !== item.id))} style={{ color: C.muted }}>
                        <X size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ---------- 장바구니 수정 페이지 ---------- */}
      {view === "cartEdit" && (
        <div className="flex flex-col flex-1 pb-24">
          <div className="flex items-center gap-3 px-4 py-4">
            <button onClick={() => setView("shopping")}><ChevronLeft size={24} color={C.paper} /></button>
            <span className="font-bold" style={{ color: C.paper }}>장바구니 수정</span>
          </div>
          <div className="px-5">
            <div className="flex items-center gap-1 mb-4">
              <input
                value={manualItemName}
                onChange={(e) => setManualItemName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addManualCartItem()}
                placeholder="새 재료 이름"
                className="px-2 py-2 rounded-lg text-sm flex-1 min-w-0"
                style={{ backgroundColor: C.raised, color: C.paper, border: `1px solid ${C.line}` }}
              />
              <input
                value={manualItemAmount}
                onChange={(e) => setManualItemAmount(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addManualCartItem()}
                placeholder="수량"
                className="px-2 py-2 rounded-lg text-sm w-16 shrink-0"
                style={{ backgroundColor: C.raised, color: C.paper, border: `1px solid ${C.line}` }}
              />
              <button
                onClick={addManualCartItem}
                className="shrink-0 w-9 h-9 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: C.ember, color: C.ink }}
              >
                <Plus size={18} />
              </button>
            </div>
            {shoppingList.length === 0 ? (
              <div className="text-center py-16" style={{ color: C.muted }}>
                <p className="mt-3 text-sm">담긴 항목이 없어요.</p>
              </div>
            ) : (
              <>
                <p style={{ color: C.muted, fontSize: 12, marginBottom: 8 }}>
                  이름·수량을 바로 수정하거나 삭제할 수 있어요.
                </p>
                <div className="rounded-xl p-3 flex flex-col gap-2" style={{ backgroundColor: C.card, border: `1px solid ${C.line}` }}>
                  {shoppingList.map((item) => (
                    <div key={item.id} className="flex items-center gap-2 py-1" style={{ borderBottom: `1px dashed ${C.line}` }}>
                      <input
                        type="checkbox"
                        checked={item.checked}
                        onChange={(e) =>
                          setShoppingList((prev) => prev.map((i) => (i.id === item.id ? { ...i, checked: e.target.checked } : i)))
                        }
                      />
                      <input
                        value={item.name}
                        onChange={(e) =>
                          setShoppingList((prev) => prev.map((i) => (i.id === item.id ? { ...i, name: e.target.value } : i)))
                        }
                        placeholder="재료 이름"
                        className="px-2 py-1.5 rounded-lg text-sm flex-1 min-w-0"
                        style={{ backgroundColor: C.raised, color: C.paper, border: `1px solid ${C.line}` }}
                      />
                      <input
                        value={item.amount || ""}
                        onChange={(e) =>
                          setShoppingList((prev) => prev.map((i) => (i.id === item.id ? { ...i, amount: e.target.value } : i)))
                        }
                        placeholder="수량"
                        className="px-2 py-1.5 rounded-lg text-sm w-16 shrink-0"
                        style={{ backgroundColor: C.raised, color: C.paper, border: `1px solid ${C.line}` }}
                      />
                      <button onClick={() => setShoppingList((prev) => prev.filter((i) => i.id !== item.id))} style={{ color: C.muted }}>
                        <X size={16} />
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => setView("shopping")}
                  className="w-full mt-4 py-3 rounded-xl font-bold flex items-center justify-center gap-1"
                  style={{ backgroundColor: C.ember, color: C.ink }}
                >
                  <Check size={16} /> 장바구니 수정완료
                </button>
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
            <p style={{ color: C.muted, fontSize: 14, lineHeight: 1.5 }}>
              이 링크를 쓰는 모두에게 보이는 공간이에요. 원하는 기능을 적거나, 마음에 드는 제안에 투표해보세요.
            </p>

            <div className="flex gap-2 mt-3">
              <input
                value={newSuggestionText}
                onChange={(e) => setNewSuggestionText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addSuggestion()}
                placeholder="예: 재료로 레시피 검색하기"
                className="flex-1 min-w-0 px-3 py-2.5 rounded-xl text-sm"
                style={{ backgroundColor: C.card, color: C.paper, border: `1px solid ${C.line}` }}
              />
              <button
                onClick={addSuggestion}
                disabled={!newSuggestionText.trim()}
                className="px-4 rounded-xl font-bold shrink-0"
                style={{ backgroundColor: C.ember, color: C.ink, opacity: newSuggestionText.trim() ? 1 : 0.5 }}
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
                        <span style={{ fontSize: 14, fontWeight: 700 }}>{s.votes}</span>
                      </button>
                      <p className="flex-1 min-w-0 text-sm" style={{ color: C.paper }}>{s.text}</p>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      )}

      {view === "account" && (
        <div className="flex flex-col flex-1 pb-10">
          <div className="flex items-center gap-3 px-4 py-4">
            <button onClick={() => setView("home")}><ChevronLeft size={24} color={C.paper} /></button>
            <span className="font-bold" style={{ color: C.paper }}>계정 정보</span>
          </div>

          <div className="px-5 flex flex-col gap-4">
            <div className="flex items-center gap-3 p-4 rounded-2xl" style={{ backgroundColor: C.card, border: `1px solid ${C.line}` }}>
              <div
                className="flex items-center justify-center rounded-full shrink-0"
                style={{ width: 48, height: 48, backgroundColor: C.ember, color: C.ink }}
              >
                <User size={22} />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold truncate" style={{ color: C.paper }}>
                  {user?.displayName || "쿡마크 사용자"}
                </p>
                <p className="text-xs truncate" style={{ color: C.muted }}>
                  {user?.email || "이메일 정보 없음"}
                </p>
              </div>
            </div>

            <button
              onClick={() => signOut(auth)}
              className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-bold"
              style={{ backgroundColor: "#FFFFFF", border: `1px solid ${C.line}`, color: C.muted }}
            >
              <LogOut size={15} />
              로그아웃
            </button>
          </div>
        </div>
      )}

      {view === "search" && (
        <div className="flex flex-col flex-1 pb-24">
          <div className="flex items-center gap-3 px-4 py-4">
            <button onClick={() => setView("home")}><ChevronLeft size={24} color={C.paper} /></button>
            <span className="font-bold" style={{ color: C.paper }}>검색</span>
          </div>

          <div className="px-5 pb-2">
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ backgroundColor: C.card, border: `1px solid ${C.line}` }}>
              <Search size={16} color={C.muted} />
              <input
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addRecentSearch(search)}
                placeholder="이름이나 재료로 찾기 (예: 대파)"
                className="bg-transparent flex-1 min-w-0 text-sm"
                style={{ color: C.paper }}
              />
              {search && (
                <button onClick={() => setSearch("")} aria-label="검색어 지우기">
                  <X size={14} color={C.muted} />
                </button>
              )}
            </div>
          </div>

          {searchQuery === "" ? (
            <div className="px-5 flex flex-col gap-6 mt-2">
              {recentSearches.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span style={{ fontSize: 12, fontWeight: 700, color: C.paper }}>최근 검색어</span>
                    <button onClick={clearRecentSearches} style={{ fontSize: 11, color: C.muted }}>전체 삭제</button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {recentSearches.map((term) => (
                      <span
                        key={term}
                        className="flex items-center gap-1 pl-3 pr-2 py-1.5 rounded-full text-xs"
                        style={{ backgroundColor: C.card, border: `1px solid ${C.line}`, color: C.paper }}
                      >
                        <button
                          onClick={() => {
                            setSearch(term);
                            addRecentSearch(term);
                          }}
                          className="truncate max-w-[140px]"
                        >
                          {term}
                        </button>
                        <button onClick={() => removeRecentSearch(term)} aria-label={`${term} 검색어 삭제`}>
                          <X size={11} color={C.muted} />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {topViewedRecipes.length > 0 && (
                <div>
                  <span style={{ fontSize: 12, fontWeight: 700, color: C.paper }}>많이 찾는 레시피</span>
                  <div className="flex flex-col gap-2 mt-2">
                    {topViewedRecipes.map((r) => (
                      <button
                        key={r.id}
                        onClick={() => openDetail(r.id)}
                        className="flex items-center gap-3 p-2.5 rounded-xl text-left"
                        style={{ backgroundColor: C.card, border: `1px solid ${C.line}` }}
                      >
                        <div
                          className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 overflow-hidden"
                          style={{ backgroundColor: C.raised }}
                        >
                          {r.photos && r.photos[0] ? (
                            <img src={r.photos[0]} alt={r.title} className="w-full h-full object-cover" />
                          ) : (
                            <ChefHat size={16} color={C.muted} />
                          )}
                        </div>
                        <span className="text-sm truncate" style={{ color: C.paper }}>{r.title}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {recentSearches.length === 0 && topViewedRecipes.length === 0 && (
                <div className="text-center py-16" style={{ color: C.muted }}>
                  <p className="text-sm">검색어를 입력해보세요.</p>
                </div>
              )}
            </div>
          ) : (
            <div className="px-5 flex flex-col gap-2 mt-2">
              {searchResults.length === 0 && (
                <div className="text-center py-16" style={{ color: C.muted }}>
                  <p className="text-sm">일치하는 레시피가 없어요.</p>
                </div>
              )}
              {searchResults.map((r) => (
                <button
                  key={r.id}
                  onClick={() => openDetail(r.id)}
                  className="flex items-center gap-3 p-3 rounded-2xl text-left"
                  style={{ backgroundColor: C.card, border: `1px solid ${C.line}` }}
                >
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 overflow-hidden"
                    style={{ backgroundColor: C.raised }}
                  >
                    {r.photos && r.photos[0] ? (
                      <img src={r.photos[0]} alt={r.title} className="w-full h-full object-cover" />
                    ) : (
                      <ChefHat size={20} color={C.muted} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold truncate" style={{ color: C.paper }}>{r.title}</div>
                    <span
                      className="text-xs px-2 py-0.5 rounded-full inline-block mt-1"
                      style={{ backgroundColor: C.emberSoft, color: C.ember, fontWeight: 700 }}
                    >
                      {r.folder}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ---------- BOTTOM NAV ---------- */}
      {(view === "home" || view === "shopping" || view === "detail" || view === "account" || view === "search") && (
        <div
          className="fixed bottom-0 left-0 right-0 max-w-md mx-auto flex items-center justify-around py-3 px-6"
          style={{ backgroundColor: C.card, borderTop: `1px solid ${C.line}` }}
        >
          <button onClick={() => setView("home")} aria-label="홈" style={{ color: view === "home" ? C.ember : C.muted }}>
            <Home size={22} />
          </button>
          <button
            onClick={() => setView("search")}
            aria-label="검색"
            style={{ color: view === "search" ? C.ember : C.muted }}
          >
            <Search size={22} />
          </button>
          <button
            onClick={() => setShowAddSheet(true)}
            aria-label="레시피 추가"
            className="w-14 h-14 rounded-full flex items-center justify-center -mt-8 shadow-lg"
            style={{ backgroundColor: C.ember, color: C.ink }}
          >
            <Plus size={26} />
          </button>
          <button onClick={() => setView("account")} aria-label="계정" style={{ color: view === "account" ? C.ember : C.muted }}>
            <User size={22} />
          </button>
          <button onClick={() => setView("shopping")} aria-label="장바구니" style={{ color: view === "shopping" ? C.ember : C.muted, position: "relative" }}>
            <div style={{ position: "relative" }}>
              <ShoppingCart size={22} />
              {shoppingList.length > 0 && (
                <span
                  className="flex items-center justify-center"
                  style={{
                    position: "absolute",
                    top: -6,
                    right: -8,
                    minWidth: 16,
                    height: 16,
                    padding: "0 4px",
                    borderRadius: 999,
                    backgroundColor: C.ember,
                    color: "#fff",
                    fontSize: 10,
                    fontWeight: 700,
                  }}
                >
                  {shoppingList.length}
                </span>
              )}
            </div>
          </button>
        </div>
      )}

      {/* ---------- ADD SHEET ---------- */}
      {showAddSheet && (
        <div className="fixed inset-0 flex items-end justify-center max-w-md mx-auto z-20" style={{ backgroundColor: "#00000099" }}>
          <div className="w-full rounded-t-3xl p-5" style={{ backgroundColor: C.ink, border: `1px solid ${C.line}` }}>
            <div className="flex items-center justify-between mb-4">
              <h3 style={{ fontFamily: "'Gowun Dodum', sans-serif", fontSize: 22 }}>레시피 담기</h3>
              <button onClick={() => { setShowAddSheet(false); setShowTextBox(false); setLoadError(""); }}><X size={22} color={C.muted} /></button>
            </div>

            {!showTextBox ? (
              <div className="flex flex-col gap-3">
                <button
                  onClick={() => { setShowTextBox(true); setLoadError(""); }}
                  className="flex items-center gap-3 p-3 rounded-2xl text-left"
                  style={{ backgroundColor: C.card, border: `1px solid ${C.line}` }}
                >
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: "#3B6FE0" }}>
                    <PencilLine size={20} color="#fff" />
                  </div>
                  <div>
                    <div className="font-bold">직접입력하기</div>
                    <div style={{ color: C.muted, fontSize: 14 }}>
                      기억나는 대로, 또는 댓글·캡션 텍스트를 그대로 적으면 AI가 재료·순서로 자동 정리해요
                    </div>
                  </div>
                </button>

                <label
                  htmlFor="recipe-photo-upload"
                  className="flex items-center gap-3 p-3 rounded-2xl text-left cursor-pointer"
                  style={{ backgroundColor: C.card, border: `1px solid ${C.line}` }}
                >
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: "#D6437E" }}>
                    <Camera size={20} color="#fff" />
                  </div>
                  <div>
                    <div className="font-bold">사진에서 가져오기</div>
                    <div style={{ color: C.muted, fontSize: 14 }}>
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
                <p style={{ color: C.muted, fontSize: 14, lineHeight: 1.5 }}>
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
                    style={{ backgroundColor: C.ember, color: C.ink, opacity: textInput.trim() ? 1 : 0.5 }}
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
            <h3 style={{ fontFamily: "'Gowun Dodum', sans-serif", fontSize: 20, color: C.paper }}>레시피를 삭제할까요?</h3>
            <p style={{ color: C.muted, fontSize: 15, marginTop: 6 }}>삭제하면 다시 되돌릴 수 없어요.</p>
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
                style={{ backgroundColor: C.ember, color: C.ink }}
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
              <h3 style={{ fontFamily: "'Gowun Dodum', sans-serif", fontSize: 22 }}>폴더 옮기기</h3>
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
              <h3 style={{ fontFamily: "'Gowun Dodum', sans-serif", fontSize: 22 }}>폴더 관리</h3>
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
              <p style={{ color: C.muted, fontSize: 15 }}>아직 만든 폴더가 없어요.</p>
            ) : (
              <>
                <p style={{ color: C.muted, fontSize: 13, marginBottom: 8 }}>≡ 손잡이를 꾹 눌러서 위아래로 끌면 순서를 바꿀 수 있어요</p>
                <div className="flex flex-col gap-2 max-h-80 overflow-y-auto">
                  {folders.map((f, idx) => (
                    <div
                      key={f}
                      ref={(el) => (folderDrag.itemRefs.current[idx] = el)}
                      className="flex items-center gap-2 px-3 py-2.5 rounded-xl"
                      style={{
                        backgroundColor: folderDrag.dragActiveIndex === idx ? C.raised : C.card,
                        border: `1px solid ${C.line}`,
                        transform: folderDrag.dragActiveIndex === idx ? `translateY(${folderDrag.dragOffsetY}px) scale(1.02)` : "translateY(0)",
                        transition: folderDrag.dragActiveIndex === idx ? "none" : "transform 150ms ease",
                        zIndex: folderDrag.dragActiveIndex === idx ? 10 : 1,
                        position: "relative",
                        boxShadow: folderDrag.dragActiveIndex === idx ? "0 6px 16px #00000066" : "none",
                      }}
                    >
                      <button
                        onPointerDown={(e) => folderDrag.handleDragStart(e, idx)}
                        onTouchStart={(e) => folderDrag.handleDragStart(e, idx)}
                        className="shrink-0 touch-none cursor-grab active:cursor-grabbing"
                        style={{ color: C.muted, padding: "2px" }}
                      >
                        <GripVertical size={16} />
                      </button>
                      <span className="flex-1" style={{ color: C.paper, fontWeight: 700 }}>{f}</span>
                      <button onClick={() => setConfirmDeleteFolder(f)} style={{ color: C.muted }}>
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ---------- CATEGORY MANAGE SHEET ---------- */}
      {showCategoryManage && (
        <div className="fixed inset-0 flex items-end justify-center max-w-md mx-auto z-20" style={{ backgroundColor: "#00000099" }}>
          <div className="w-full rounded-t-3xl p-5" style={{ backgroundColor: C.ink, border: `1px solid ${C.line}` }}>
            <div className="flex items-center justify-between mb-4">
              <h3 style={{ fontFamily: "'Gowun Dodum', sans-serif", fontSize: 22 }}>카테고리 관리</h3>
              <button onClick={() => setShowCategoryManage(false)}><X size={22} color={C.muted} /></button>
            </div>
            {categories.length === 0 ? (
              <p style={{ color: C.muted, fontSize: 15 }}>아직 만든 카테고리가 없어요.</p>
            ) : (
              <>
                <p style={{ color: C.muted, fontSize: 13, marginBottom: 8 }}>≡ 손잡이를 꾹 눌러서 위아래로 끌면 순서를 바꿀 수 있어요</p>
                <div className="flex flex-col gap-2 max-h-80 overflow-y-auto">
                  {categories.map((c, idx) => (
                    <div
                      key={c}
                      ref={(el) => (categoryDrag.itemRefs.current[idx] = el)}
                      className="flex items-center gap-2 px-3 py-2.5 rounded-xl"
                      style={{
                        backgroundColor: categoryDrag.dragActiveIndex === idx ? C.raised : C.card,
                        border: `1px solid ${C.line}`,
                        transform: categoryDrag.dragActiveIndex === idx ? `translateY(${categoryDrag.dragOffsetY}px) scale(1.02)` : "translateY(0)",
                        transition: categoryDrag.dragActiveIndex === idx ? "none" : "transform 150ms ease",
                        zIndex: categoryDrag.dragActiveIndex === idx ? 10 : 1,
                        position: "relative",
                        boxShadow: categoryDrag.dragActiveIndex === idx ? "0 6px 16px #00000066" : "none",
                      }}
                    >
                      <button
                        onPointerDown={(e) => categoryDrag.handleDragStart(e, idx)}
                        onTouchStart={(e) => categoryDrag.handleDragStart(e, idx)}
                        className="shrink-0 touch-none cursor-grab active:cursor-grabbing"
                        style={{ color: C.muted, padding: "2px" }}
                      >
                        <GripVertical size={16} />
                      </button>
                      <span className="flex-1" style={{ color: C.paper, fontWeight: 700 }}>{c}</span>
                      <button onClick={() => setConfirmDeleteCategory(c)} style={{ color: C.muted }}>
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ---------- CATEGORY DELETE CONFIRM ---------- */}
      {confirmDeleteCategory && (
        <div className="fixed inset-0 flex items-center justify-center max-w-md mx-auto z-40 px-6" style={{ backgroundColor: "#000000cc" }}>
          <div className="w-full rounded-2xl p-5" style={{ backgroundColor: C.card, border: `1px solid ${C.line}` }}>
            <h3 style={{ fontFamily: "'Gowun Dodum', sans-serif", fontSize: 20, color: C.paper }}>
              "{confirmDeleteCategory}" 카테고리를 삭제할까요?
            </h3>
            <p style={{ color: C.muted, fontSize: 15, marginTop: 6 }}>
              이 카테고리의 레시피는 사라지지 않고 다른 카테고리로 옮겨져요.
            </p>
            <div className="flex gap-2 mt-5">
              <button
                onClick={() => setConfirmDeleteCategory(null)}
                className="flex-1 py-3 rounded-xl font-bold"
                style={{ backgroundColor: C.raised, color: C.muted }}
              >
                취소
              </button>
              <button
                onClick={() => performDeleteCategory(confirmDeleteCategory)}
                className="flex-1 py-3 rounded-xl font-bold"
                style={{ backgroundColor: C.ember, color: C.ink }}
              >
                삭제하기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------- FOLDER DELETE CONFIRM ---------- */}
      {confirmDeleteFolder && (
        <div className="fixed inset-0 flex items-center justify-center max-w-md mx-auto z-40 px-6" style={{ backgroundColor: "#000000cc" }}>
          <div className="w-full rounded-2xl p-5" style={{ backgroundColor: C.card, border: `1px solid ${C.line}` }}>
            <h3 style={{ fontFamily: "'Gowun Dodum', sans-serif", fontSize: 20, color: C.paper }}>
              "{confirmDeleteFolder}" 폴더를 삭제할까요?
            </h3>
            <p style={{ color: C.muted, fontSize: 15, marginTop: 6 }}>
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
                style={{ backgroundColor: C.ember, color: C.ink }}
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
          <p className="mt-3 text-sm" style={{ color: C.ink }}>{loadingMsg}</p>
        </div>
      )}
    </div>
  );
}
