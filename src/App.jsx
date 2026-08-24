import { useState, useEffect, useRef, useCallback } from "react";
import {
  Camera, Target, TrendingUp, Trophy, Home, Flame, Footprints,
  Scale, UtensilsCrossed, ChevronRight, Check, X, Loader2, Mountain,
  Clock, Sparkles, ImagePlus, ArrowRight, Info
} from "lucide-react";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend
} from "recharts";
import { dGet, dSet, dListPrefix, getWhoAmI, setWhoAmI } from "./firebase.js";

// ---------- palette / tokens ----------
const COLORS = {
  bg: "#161C24",
  bgRaised: "#1E2733",
  bgCard: "#212B38",
  gold: "#D4A24E",
  goldSoft: "#E8C88A",
  teal: "#5B9C8C",
  coral: "#E1704A",
  text: "#F1EDE4",
  textDim: "#9AA5B1",
  line: "#2E3947",
  personA: "#D4A24E",
  personB: "#5B9C8C",
};

const todayISO = () => new Date().toISOString().slice(0, 10);
const weekOf = (d = new Date()) => {
  const dt = new Date(d);
  const day = dt.getDay();
  const diff = dt.getDate() - day; // start Sunday
  const sunday = new Date(dt.setDate(diff));
  return sunday.toISOString().slice(0, 10);
};
const fmtDate = (iso) =>
  new Date(iso + "T00:00:00").toLocaleDateString(undefined, {
    weekday: "short", month: "short", day: "numeric",
  });
const uid = () => Math.random().toString(36).slice(2, 10);

function fileToBase64(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result.split(",")[1]);
    r.onerror = () => rej(new Error("read failed"));
    r.readAsDataURL(file);
  });
}

async function askClaude({ text, images = [], system, jsonOnly = false }) {
  const resp = await fetch("/api/claude", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, images, system, jsonOnly }),
  });
  const data = await resp.json();
  if (data.error) throw new Error(typeof data.error === "string" ? data.error : "AI request failed");
  return data.result;
}

// ---------- storage helpers (Firestore-backed, shared across both partners) ----------
const sGet = (key) => dGet(key);
const sSet = (key, value) => dSet(key, value);
const sList = (prefix) => dListPrefix(prefix);

// ---------- small UI atoms ----------
const Card = ({ children, style }) => (
  <div
    style={{
      background: COLORS.bgCard,
      borderRadius: 16,
      padding: 18,
      border: `1px solid ${COLORS.line}`,
      ...style,
    }}
  >
    {children}
  </div>
);

const Btn = ({ children, onClick, variant = "solid", disabled, style, full }) => {
  const base = {
    border: "none",
    borderRadius: 12,
    padding: "12px 18px",
    fontSize: 15,
    fontWeight: 600,
    fontFamily: "inherit",
    cursor: disabled ? "not-allowed" : "pointer",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    opacity: disabled ? 0.5 : 1,
    width: full ? "100%" : undefined,
    transition: "transform .08s ease",
  };
  const variants = {
    solid: { background: COLORS.gold, color: "#1A130A" },
    ghost: { background: "transparent", color: COLORS.gold, border: `1px solid ${COLORS.gold}55` },
    teal: { background: COLORS.teal, color: "#0B1512" },
    subtle: { background: COLORS.bgRaised, color: COLORS.text },
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{ ...base, ...variants[variant], ...style }}
      onMouseDown={(e) => (e.currentTarget.style.transform = "scale(.97)")}
      onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
    >
      {children}
    </button>
  );
};

const Field = ({ label, children }) => (
  <label style={{ display: "block", marginBottom: 12 }}>
    <div style={{ fontSize: 12, color: COLORS.textDim, marginBottom: 6, letterSpacing: 0.3 }}>
      {label}
    </div>
    {children}
  </label>
);

const inputStyle = {
  width: "100%",
  background: COLORS.bgRaised,
  border: `1px solid ${COLORS.line}`,
  borderRadius: 10,
  padding: "10px 12px",
  color: COLORS.text,
  fontSize: 15,
  boxSizing: "border-box",
  fontFamily: "inherit",
};

// ---------- Ridgeline signature visualization ----------
function RidgeSVG({ people }) {
  // people: [{name, color, pct}] pct 0-100 progress toward goal
  const w = 340, h = 140;
  const path = `M0,${h - 20} L40,${h - 60} L80,${h - 35} L130,${h - 90} L180,${h - 45} L230,${h - 100} L280,${h - 55} L${w},${h - 85}`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h}>
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2A3646" />
          <stop offset="100%" stopColor="#161C24" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width={w} height={h} fill="url(#sky)" rx="12" />
      <path d={path} fill="none" stroke={COLORS.line} strokeWidth="3" strokeLinecap="round" />
      {people.map((p, i) => {
        const clamped = Math.max(2, Math.min(98, p.pct));
        const x = (clamped / 100) * w;
        // approximate y along the jagged path by simple interpolation
        const y = h - 30 - (clamped / 100) * 55 - (i % 2 === 0 ? 6 : -6);
        return (
          <g key={p.name} transform={`translate(${x},${y})`}>
            <circle r="9" fill={p.color} stroke="#0B0F14" strokeWidth="2" />
            <text y="-14" textAnchor="middle" fontSize="11" fill={p.color} fontWeight="700">
              {p.name}
            </text>
          </g>
        );
      })}
      <g transform={`translate(${w - 14},${h - 92})`}>
        <path d="M0,0 L6,10 L-6,10 Z" fill={COLORS.gold} />
      </g>
    </svg>
  );
}

// ---------- Camera capture control (take photo OR upload from gallery) ----------
function CaptureButton({ label, onImage, icon: Icon = Camera }) {
  const camRef = useRef();
  const fileRef = useRef();

  const handleFile = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const data = await fileToBase64(f);
    onImage({ data, type: f.type || "image/jpeg" });
    e.target.value = "";
  };

  return (
    <div style={{ display: "flex", gap: 10 }}>
      <input
        ref={camRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: "none" }}
        onChange={handleFile}
      />
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={handleFile}
      />
      <Btn onClick={() => camRef.current.click()} style={{ flex: 1 }}>
        <Icon size={18} /> {label}
      </Btn>
      <Btn variant="ghost" onClick={() => fileRef.current.click()} style={{ flex: 1 }}>
        <ImagePlus size={18} /> Upload
      </Btn>
    </div>
  );
}

// ================= SETUP =================
function Setup({ onDone }) {
  const [roster, setRoster] = useState([]);
  const [step, setStep] = useState("pick"); // pick | profile
  const [name, setName] = useState("");
  const [profile, setProfile] = useState({
    heightCm: "", age: "", sex: "female", activity: "moderate",
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const r = (await sGet("roster")) || [];
      setRoster(r);
      setLoading(false);
    })();
  }, []);

  const pickExisting = async (n) => {
    setWhoAmI(n);
    onDone(n);
  };

  const createNew = async () => {
    if (!name.trim()) return;
    setStep("profile");
  };

  const finishProfile = async () => {
    const n = name.trim();
    const newRoster = Array.from(new Set([...roster, n]));
    await sSet("roster", newRoster);
    await sSet(`profile:${n}`, {
      heightCm: Number(profile.heightCm) || null,
      age: Number(profile.age) || null,
      sex: profile.sex,
      activity: profile.activity,
    });
    setWhoAmI(n);
    onDone(n);
  };

  if (loading) return <Centered><Loader2 className="spin" size={28} /></Centered>;

  return (
    <Centered>
      <div style={{ width: "100%", maxWidth: 380 }}>
        <div style={{ textAlign: "center", marginBottom: 22 }}>
          <Mountain size={34} color={COLORS.gold} />
          <h1 style={{ fontFamily: "Fraunces, serif", fontSize: 26, margin: "10px 0 2px" }}>
            Ridgeline
          </h1>
          <div style={{ color: COLORS.textDim, fontSize: 13 }}>
            Two of you. One climb.
          </div>
        </div>

        {step === "pick" && (
          <Card>
            {roster.length > 0 && (
              <>
                <div style={{ fontSize: 13, color: COLORS.textDim, marginBottom: 10 }}>
                  Who's on this device?
                </div>
                {roster.map((n) => (
                  <Btn key={n} variant="subtle" full style={{ marginBottom: 8 }} onClick={() => pickExisting(n)}>
                    {n} <ChevronRight size={16} style={{ marginLeft: "auto" }} />
                  </Btn>
                ))}
                <div style={{ height: 14 }} />
              </>
            )}
            <Field label="Or add a new person">
              <input style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
            </Field>
            <Btn full onClick={createNew} disabled={!name.trim()}>Continue <ArrowRight size={16} /></Btn>
          </Card>
        )}

        {step === "profile" && (
          <Card>
            <div style={{ fontSize: 13, color: COLORS.textDim, marginBottom: 12 }}>
              Quick profile for {name} — used to work out your calorie targets.
            </div>
            <Field label="Height (cm)">
              <input style={inputStyle} type="number" value={profile.heightCm}
                onChange={(e) => setProfile({ ...profile, heightCm: e.target.value })} />
            </Field>
            <Field label="Age">
              <input style={inputStyle} type="number" value={profile.age}
                onChange={(e) => setProfile({ ...profile, age: e.target.value })} />
            </Field>
            <Field label="Sex (for BMR calculation)">
              <select style={inputStyle} value={profile.sex}
                onChange={(e) => setProfile({ ...profile, sex: e.target.value })}>
                <option value="female">Female</option>
                <option value="male">Male</option>
              </select>
            </Field>
            <Field label="Activity level">
              <select style={inputStyle} value={profile.activity}
                onChange={(e) => setProfile({ ...profile, activity: e.target.value })}>
                <option value="sedentary">Sedentary (desk job, little exercise)</option>
                <option value="light">Light (1-3 sessions/week)</option>
                <option value="moderate">Moderate (3-5 sessions/week)</option>
                <option value="high">High (daily training)</option>
                <option value="veryhigh">Very high (marathon/ultra training)</option>
              </select>
            </Field>
            <Btn full onClick={finishProfile}>Start climbing <ArrowRight size={16} /></Btn>
          </Card>
        )}
      </div>
    </Centered>
  );
}

const Centered = ({ children }) => (
  <div style={{
    minHeight: "100vh", display: "flex", alignItems: "center",
    justifyContent: "center", background: COLORS.bg, color: COLORS.text,
    padding: 20, boxSizing: "border-box",
  }}>
    {children}
  </div>
);

// ================= BMR / calorie math =================
const ACTIVITY_MULT = { sedentary: 1.2, light: 1.375, moderate: 1.55, high: 1.725, veryhigh: 1.9 };
function bmr({ heightCm, age, sex, weightKg }) {
  if (!heightCm || !age || !weightKg) return null;
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  return sex === "male" ? base + 5 : base - 161;
}

// ================= APP SHELL =================
export default function App() {
  const [me, setMe] = useState(null);
  const [checking, setChecking] = useState(true);
  const [roster, setRoster] = useState([]);
  const [tab, setTab] = useState("today");

  useEffect(() => {
    (async () => {
      const existing = getWhoAmI();
      if (existing) setMe(existing);
      const ro = (await sGet("roster")) || [];
      setRoster(ro);
      setChecking(false);
    })();
  }, []);

  if (checking) return <Centered><Loader2 size={26} /></Centered>;
  if (!me) return <Setup onDone={(n) => { setMe(n); setRoster((r) => Array.from(new Set([...r, n]))); }} />;

  const partner = roster.find((n) => n !== me) || null;

  return (
    <div style={{
      minHeight: "100vh", background: COLORS.bg, color: COLORS.text,
      fontFamily: "'Inter', system-ui, sans-serif", paddingBottom: 78,
    }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .spin { animation: spin 1s linear infinite; }
        * { box-sizing: border-box; }
      `}</style>

      <header style={{ padding: "18px 18px 8px", display: "flex", alignItems: "center", gap: 10 }}>
        <Mountain size={22} color={COLORS.gold} />
        <div style={{ fontFamily: "Fraunces, serif", fontSize: 19, fontWeight: 600 }}>Ridgeline</div>
        <div style={{ marginLeft: "auto", fontSize: 12, color: COLORS.textDim }}>
          {me}{partner ? ` & ${partner}` : ""}
        </div>
      </header>

      <main style={{ padding: "6px 16px 16px", maxWidth: 480, margin: "0 auto" }}>
        {tab === "today" && <TodayTab me={me} partner={partner} />}
        {tab === "scan" && <ScanTab me={me} />}
        {tab === "goal" && <GoalTab me={me} />}
        {tab === "progress" && <ProgressTab me={me} partner={partner} />}
        {tab === "compete" && <CompeteTab me={me} partner={partner} />}
      </main>

      <nav style={{
        position: "fixed", bottom: 0, left: 0, right: 0, background: COLORS.bgRaised,
        borderTop: `1px solid ${COLORS.line}`, display: "flex", padding: "8px 6px",
        justifyContent: "space-around",
      }}>
        {[
          ["today", "Today", Home],
          ["scan", "Scan", Camera],
          ["goal", "Goal", Target],
          ["progress", "Progress", TrendingUp],
          ["compete", "Compete", Trophy],
        ].map(([key, label, Icon]) => (
          <button key={key} onClick={() => setTab(key)} style={{
            background: "none", border: "none", display: "flex", flexDirection: "column",
            alignItems: "center", gap: 3, color: tab === key ? COLORS.gold : COLORS.textDim,
            fontSize: 11, cursor: "pointer", padding: "4px 8px",
          }}>
            <Icon size={20} />
            {label}
          </button>
        ))}
      </nav>
    </div>
  );
}

// ================= TODAY TAB =================
function TodayTab({ me, partner }) {
  const [weighIn, setWeighIn] = useState(null);
  const [goal, setGoal] = useState(null);
  const [partnerGoal, setPartnerGoal] = useState(null);
  const [foods, setFoods] = useState([]);
  const [activity, setActivity] = useState({ steps: "", exerciseMinutes: "", exerciseType: "", loggedComplete: false });
  const [profile, setProfile] = useState(null);
  const [partnerLatestWeight, setPartnerLatestWeight] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const d = todayISO();
    const [w, g, pg, f, a, p] = await Promise.all([
      sGet(`weighins:${me}:${d}`),
      sGet(`goal:${me}`),
      partner ? sGet(`goal:${partner}`) : null,
      sGet(`food:${me}:${d}`),
      sGet(`activity:${me}:${d}`),
      sGet(`profile:${me}`),
    ]);
    setWeighIn(w); setGoal(g); setPartnerGoal(pg); setFoods(f || []);
    setActivity(a || { steps: "", exerciseMinutes: "", exerciseType: "", loggedComplete: false });
    setProfile(p);
    if (partner) {
      const keys = await sList(`weighins:${partner}:`);
      if (keys.length) {
        const latestKey = keys.sort().at(-1);
        const pw = await sGet(latestKey);
        setPartnerLatestWeight(pw?.weight ?? null);
      }
    }
    setLoading(false);
  }, [me, partner]);

  useEffect(() => { load(); }, [load]);

  const caloriesIn = foods.reduce((s, f) => s + (Number(f.calories) || 0), 0);
  const myBmr = profile && weighIn ? bmr({ ...profile, weightKg: weighIn.weight }) : null;
  const burnFromActivity = (Number(activity.exerciseMinutes) || 0) * 7; // rough kcal/min estimate
  const caloriesOut = myBmr ? Math.round(myBmr * (ACTIVITY_MULT[profile?.activity] || 1.4)) + burnFromActivity : null;
  const ratio = caloriesOut ? Math.min(1.6, caloriesIn / caloriesOut) : null;

  const saveActivity = async (patch) => {
    const next = { ...activity, ...patch };
    setActivity(next);
    await sSet(`activity:${me}:${todayISO()}`, next);
  };

  const markComplete = async () => {
    const hour = new Date().getHours();
    const onTime = hour < 21;
    const next = { ...activity, loggedComplete: true, completedOnTime: onTime, completedAt: new Date().toISOString() };
    setActivity(next);
    await sSet(`activity:${me}:${todayISO()}`, next);
  };

  if (loading) return <Centered><Loader2 size={22} /></Centered>;

  const myPct = goal ? progressPct(goal, weighIn?.weight) : 0;
  const partnerPct = partnerGoal ? progressPct(partnerGoal, partnerLatestWeight) : 0;

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <Card>
        <div style={{ fontSize: 13, color: COLORS.textDim, marginBottom: 8 }}>{fmtDate(todayISO())}</div>
        <RidgeSVG people={[
          { name: me, color: COLORS.personA, pct: myPct },
          ...(partner ? [{ name: partner, color: COLORS.personB, pct: partnerPct }] : []),
        ]} />
      </Card>

      <Card>
        <SectionTitle icon={Scale}>Today's weigh-in</SectionTitle>
        {weighIn ? (
          <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
            <Stat label="Weight" value={`${weighIn.weight} kg`} />
            {weighIn.bodyFatPct != null && <Stat label="Body fat" value={`${weighIn.bodyFatPct}%`} />}
            {weighIn.musclePct != null && <Stat label="Muscle" value={`${weighIn.musclePct}%`} />}
          </div>
        ) : (
          <div style={{ color: COLORS.textDim, fontSize: 14 }}>
            Not logged yet — head to the Scan tab and snap the scale.
          </div>
        )}
      </Card>

      <Card>
        <SectionTitle icon={Flame}>Calories in vs out</SectionTitle>
        <div style={{ display: "flex", gap: 18, marginBottom: 10 }}>
          <Stat label="In" value={`${caloriesIn} kcal`} color={COLORS.gold} />
          <Stat label="Out (est.)" value={caloriesOut ? `${caloriesOut} kcal` : "—"} color={COLORS.teal} />
        </div>
        {ratio != null && (
          <div style={{ background: COLORS.bgRaised, borderRadius: 8, height: 10, overflow: "hidden" }}>
            <div style={{
              width: `${Math.min(100, ratio * 100)}%`, height: "100%",
              background: ratio > 1.05 ? COLORS.coral : COLORS.teal, transition: "width .3s",
            }} />
          </div>
        )}
        {!myBmr && (
          <div style={{ fontSize: 12, color: COLORS.textDim, marginTop: 8 }}>
            <Info size={12} style={{ verticalAlign: -2 }} /> Log today's weigh-in and complete your profile to see an accurate burn estimate.
          </div>
        )}
        {foods.length > 0 && (
          <div style={{ marginTop: 10, fontSize: 13, color: COLORS.textDim }}>
            {foods.length} item{foods.length > 1 ? "s" : ""} logged today
          </div>
        )}
      </Card>

      <Card>
        <SectionTitle icon={Footprints}>Steps & activity</SectionTitle>
        <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
          <input style={inputStyle} type="number" placeholder="Steps today" value={activity.steps}
            onChange={(e) => saveActivity({ steps: e.target.value })} />
        </div>
        <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
          <input style={inputStyle} type="number" placeholder="Exercise mins" value={activity.exerciseMinutes}
            onChange={(e) => saveActivity({ exerciseMinutes: e.target.value })} />
          <input style={inputStyle} placeholder="What did you do?" value={activity.exerciseType}
            onChange={(e) => saveActivity({ exerciseType: e.target.value })} />
        </div>
        {activity.loggedComplete ? (
          <div style={{ color: COLORS.teal, fontSize: 14, display: "flex", alignItems: "center", gap: 6 }}>
            <Check size={16} /> Logged for today {activity.completedOnTime === false ? "(after 9pm — sneaky)" : ""}
          </div>
        ) : (
          <Btn full variant="teal" onClick={markComplete}>
            <Check size={16} /> Mark today complete
          </Btn>
        )}
        <div style={{ fontSize: 11, color: COLORS.textDim, marginTop: 8, display: "flex", alignItems: "center", gap: 4 }}>
          <Clock size={12} /> Log by 9pm to keep your streak against {partner || "your partner"}.
        </div>
      </Card>
    </div>
  );
}

function progressPct(goal, currentWeight) {
  if (!goal || currentWeight == null || goal.startWeight == null) return 0;
  const total = goal.startWeight - goal.targetWeight;
  if (!total) return 100;
  const done = goal.startWeight - currentWeight;
  return Math.max(0, Math.min(100, (done / total) * 100));
}

const SectionTitle = ({ icon: Icon, children }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, fontWeight: 600, fontSize: 14 }}>
    <Icon size={16} color={COLORS.gold} /> {children}
  </div>
);
const Stat = ({ label, value, color }) => (
  <div>
    <div style={{ fontSize: 20, fontWeight: 700, color: color || COLORS.text }}>{value}</div>
    <div style={{ fontSize: 11, color: COLORS.textDim }}>{label}</div>
  </div>
);

// ================= SCAN TAB =================
function ScanTab({ me }) {
  const [mode, setMode] = useState(null); // 'scale' | 'food' | 'body'
  return (
    <div style={{ display: "grid", gap: 14 }}>
      {!mode && (
        <>
          <Card>
            <SectionTitle icon={Scale}>Morning scale</SectionTitle>
            <div style={{ fontSize: 13, color: COLORS.textDim, marginBottom: 12 }}>
              Photograph your body-analysis scale display and I'll read off the numbers.
            </div>
            <Btn full onClick={() => setMode("scale")}><Camera size={16} /> Scan scale</Btn>
          </Card>
          <Card>
            <SectionTitle icon={UtensilsCrossed}>Food or drink</SectionTitle>
            <div style={{ fontSize: 13, color: COLORS.textDim, marginBottom: 12 }}>
              Snap what you're eating. I may ask a quick question, then estimate calories.
            </div>
            <Btn full onClick={() => setMode("food")}><Camera size={16} /> Log food</Btn>
          </Card>
          <Card>
            <SectionTitle icon={Sparkles}>Weekly body check</SectionTitle>
            <div style={{ fontSize: 13, color: COLORS.textDim, marginBottom: 12 }}>
              Once a week — a photo and a few honest, useful pointers.
            </div>
            <Btn full onClick={() => setMode("body")}><Camera size={16} /> Weekly check-in</Btn>
          </Card>
        </>
      )}
      {mode === "scale" && <ScaleFlow me={me} onClose={() => setMode(null)} />}
      {mode === "food" && <FoodFlow me={me} onClose={() => setMode(null)} />}
      {mode === "body" && <BodyFlow me={me} onClose={() => setMode(null)} />}
    </div>
  );
}

function FlowShell({ title, onClose, children }) {
  return (
    <Card>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 12 }}>
        <div style={{ fontWeight: 600 }}>{title}</div>
        <button onClick={onClose} style={{ marginLeft: "auto", background: "none", border: "none", color: COLORS.textDim, cursor: "pointer" }}>
          <X size={18} />
        </button>
      </div>
      {children}
    </Card>
  );
}

function ScaleFlow({ me, onClose }) {
  const [img, setImg] = useState(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const analyze = async (image) => {
    setImg(image); setBusy(true); setError(null);
    try {
      const data = await askClaude({
        images: [image],
        system: "You read body-composition bathroom scale displays from photos. Extract every metric visible (weight, body fat %, muscle %, water %, bone mass, visceral fat, BMI etc). If the scale shows kg use kg; if lb convert to kg (1 lb = 0.453592 kg). Respond with ONLY a compact JSON object with keys among: weight, bodyFatPct, musclePct, waterPct, boneMassKg, visceralFat, bmi — omit keys not visible. weight must be present and numeric in kg.",
        text: "Extract the readings from this scale photo as JSON only.",
        jsonOnly: true,
      });
      setResult(data);
    } catch (e) {
      setError("Couldn't read that clearly — try a straighter, well-lit photo of the display.");
    }
    setBusy(false);
  };

  const save = async () => {
    await sSet(`weighins:${me}:${todayISO()}`, result);
    // seed goal start weight if missing
    const goal = await sGet(`goal:${me}`);
    if (goal && goal.startWeight == null) {
      await sSet(`goal:${me}`, { ...goal, startWeight: result.weight });
    }
    onClose();
  };

  return (
    <FlowShell title="Scan scale" onClose={onClose}>
      {!img && <CaptureButton label="Take photo of scale" onImage={analyze} />}
      {busy && <div style={{ marginTop: 12, color: COLORS.textDim }}><Loader2 className="spin" size={16} style={{ verticalAlign: -3 }} /> Reading display…</div>}
      {error && <div style={{ color: COLORS.coral, marginTop: 10, fontSize: 13 }}>{error}</div>}
      {result && (
        <div style={{ marginTop: 14 }}>
          {Object.entries(result).map(([k, v]) => (
            <Field key={k} label={k}>
              <input style={inputStyle} type="number" value={v}
                onChange={(e) => setResult({ ...result, [k]: Number(e.target.value) })} />
            </Field>
          ))}
          <Btn full onClick={save}><Check size={16} /> Save reading</Btn>
        </div>
      )}
    </FlowShell>
  );
}

function FoodFlow({ me, onClose }) {
  const [img, setImg] = useState(null);
  const [desc, setDesc] = useState("");
  const [busy, setBusy] = useState(false);
  const [clarify, setClarify] = useState(null);
  const [answer, setAnswer] = useState("");
  const [result, setResult] = useState(null);

  const analyze = async (image, extraAnswer) => {
    setBusy(true);
    const data = await askClaude({
      images: image ? [image] : [],
      system: "You are a careful nutrition estimator. Look at the food/drink photo (if given) and description. If you genuinely cannot tell portion size, cooking method, or a key ingredient that would change the calorie count a lot, ask ONE short clarifying question instead of guessing. Otherwise, estimate calories and macros. Respond with ONLY JSON: either {\"needsClarification\": \"question text\"} or {\"description\": \"short label\", \"calories\": number, \"protein\": number, \"carbs\": number, \"fat\": number}.",
      text: `Description from user: "${desc || "(none given)"}"${extraAnswer ? `\nClarifying answer: "${extraAnswer}"` : ""}\nEstimate the calories.`,
      jsonOnly: true,
    });
    setBusy(false);
    if (data.needsClarification) {
      setClarify(data.needsClarification);
    } else {
      setResult(data);
      setClarify(null);
    }
  };

  const save = async () => {
    const d = todayISO();
    const existing = (await sGet(`food:${me}:${d}`)) || [];
    existing.push({ id: uid(), time: new Date().toISOString(), ...result });
    await sSet(`food:${me}:${d}`, existing);
    onClose();
  };

  return (
    <FlowShell title="Log food or drink" onClose={onClose}>
      {!result && (
        <>
          {!img && <CaptureButton label="Take photo of food/drink" onImage={(i) => setImg(i)} />}
          {img && <div style={{ fontSize: 12, color: COLORS.teal, margin: "8px 0" }}><Check size={12} style={{ verticalAlign: -2 }} /> Photo captured</div>}
          <Field label="Description (optional but helps accuracy)">
            <input style={inputStyle} value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="e.g. grilled chicken salad, olive oil dressing" />
          </Field>
          {!clarify && (
            <Btn full onClick={() => analyze(img)} disabled={!img && !desc}>
              {busy ? <Loader2 className="spin" size={16} /> : <Sparkles size={16} />} Estimate calories
            </Btn>
          )}
          {clarify && (
            <div style={{ marginTop: 10 }}>
              <div style={{ fontSize: 13, marginBottom: 8, color: COLORS.goldSoft }}>{clarify}</div>
              <input style={inputStyle} value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="Your answer" />
              <div style={{ height: 10 }} />
              <Btn full onClick={() => analyze(img, answer)}>
                {busy ? <Loader2 className="spin" size={16} /> : <ArrowRight size={16} />} Continue
              </Btn>
            </div>
          )}
        </>
      )}
      {result && (
        <div>
          <Field label="Item"><input style={inputStyle} value={result.description}
            onChange={(e) => setResult({ ...result, description: e.target.value })} /></Field>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {["calories", "protein", "carbs", "fat"].map((k) => (
              <Field key={k} label={k}>
                <input style={inputStyle} type="number" value={result[k] ?? ""}
                  onChange={(e) => setResult({ ...result, [k]: Number(e.target.value) })} />
              </Field>
            ))}
          </div>
          <Btn full onClick={save}><Check size={16} /> Add to today's log</Btn>
        </div>
      )}
    </FlowShell>
  );
}

function BodyFlow({ me, onClose }) {
  const [img, setImg] = useState(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  const analyze = async (image) => {
    setImg(image); setBusy(true);
    const data = await askClaude({
      images: [image],
      system: "You are a supportive, practical personal trainer reviewing a weekly progress photo. Be encouraging and specific, never body-shaming or clinical. Suggest 2-4 concrete, actionable focus areas (e.g. specific exercise types, posture, consistency habits) based only on what's visibly reasonable to comment on from a fitness-progress standpoint. Respond with ONLY JSON: {\"summary\": \"one encouraging sentence\", \"actions\": [\"action 1\", \"action 2\", ...]}.",
      text: "Give this week's observations and action items.",
      jsonOnly: true,
    });
    setResult(data);
    setBusy(false);
  };

  const save = async () => {
    await sSet(`bodycheck:${me}:${weekOf()}`, { ...result, date: todayISO() });
    onClose();
  };

  return (
    <FlowShell title="Weekly body check" onClose={onClose}>
      {!result && !img && <CaptureButton label="Take weekly photo" onImage={analyze} />}
      {busy && <div style={{ marginTop: 12, color: COLORS.textDim }}><Loader2 className="spin" size={16} style={{ verticalAlign: -3 }} /> Reviewing…</div>}
      {result && (
        <div>
          <div style={{ fontSize: 14, marginBottom: 10 }}>{result.summary}</div>
          <ul style={{ paddingLeft: 18, marginBottom: 14 }}>
            {result.actions?.map((a, i) => <li key={i} style={{ marginBottom: 6, fontSize: 13 }}>{a}</li>)}
          </ul>
          <Btn full onClick={save}><Check size={16} /> Save this week's check-in</Btn>
        </div>
      )}
    </FlowShell>
  );
}

// ================= GOAL TAB =================
function GoalTab({ me }) {
  const [profile, setProfile] = useState({ heightCm: "", age: "", sex: "female", activity: "moderate" });
  const [goal, setGoal] = useState({ targetWeight: "", targetDate: "", startWeight: null, plan: null });
  const [fasting, setFasting] = useState({ enabled: false, days: [], windowStart: "12:00", windowEnd: "20:00" });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const p = await sGet(`profile:${me}`);
      const g = await sGet(`goal:${me}`);
      const f = await sGet(`fasting:${me}`);
      if (p) setProfile(p);
      if (g) setGoal(g);
      if (f) setFasting(f);
    })();
  }, [me]);

  const toggleDay = (d) => {
    const days = fasting.days.includes(d) ? fasting.days.filter((x) => x !== d) : [...fasting.days, d];
    const next = { ...fasting, days };
    setFasting(next);
    sSet(`fasting:${me}`, next);
  };

  const calcPlan = async () => {
    setBusy(true);
    const latestWeighKeys = await sList(`weighins:${me}:`);
    let currentWeight = goal.startWeight;
    if (latestWeighKeys.length) {
      const latest = await sGet(latestWeighKeys.sort().at(-1));
      currentWeight = latest?.weight ?? currentWeight;
    }
    const plan = await askClaude({
      system: "You are a sensible, safety-conscious nutrition coach. Never recommend under 1200 kcal/day for women or 1500 for men, and never more than ~1% bodyweight loss per week. Respond with ONLY JSON: {\"dailyCalorieTarget\": number, \"weeklyRateKg\": number, \"proteinTargetG\": number, \"notes\": \"1-2 short sentences of practical advice, mentioning their fasting schedule if relevant\"}.",
      text: `Person: ${profile.sex}, ${profile.age}y, ${profile.heightCm}cm, activity level ${profile.activity}. Current weight: ${currentWeight}kg. Target weight: ${goal.targetWeight}kg by ${goal.targetDate}. Fasting schedule: ${fasting.enabled ? `${fasting.days.join(", ")} eating window ${fasting.windowStart}-${fasting.windowEnd}` : "none"}. Work out a realistic daily calorie target and weekly rate to hit the goal safely by the date, adjusting the timeline in your notes if the date is unrealistic.`,
      jsonOnly: true,
    });
    const nextGoal = { ...goal, startWeight: goal.startWeight ?? currentWeight, plan };
    setGoal(nextGoal);
    await sSet(`goal:${me}`, nextGoal);
    await sSet(`profile:${me}`, profile);
    setBusy(false);
  };

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <Card>
        <SectionTitle icon={Target}>Your goal</SectionTitle>
        <Field label="Target weight (kg)">
          <input style={inputStyle} type="number" value={goal.targetWeight}
            onChange={(e) => setGoal({ ...goal, targetWeight: e.target.value })} />
        </Field>
        <Field label="Target date">
          <input style={inputStyle} type="date" value={goal.targetDate}
            onChange={(e) => setGoal({ ...goal, targetDate: e.target.value })} />
        </Field>
      </Card>

      <Card>
        <SectionTitle icon={Clock}>Fasting</SectionTitle>
        <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, fontSize: 14 }}>
          <input type="checkbox" checked={fasting.enabled}
            onChange={(e) => { const n = { ...fasting, enabled: e.target.checked }; setFasting(n); sSet(`fasting:${me}`, n); }} />
          I follow a fasting schedule
        </label>
        {fasting.enabled && (
          <>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
              {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((d) => (
                <button key={d} onClick={() => toggleDay(d)} style={{
                  padding: "6px 10px", borderRadius: 8, fontSize: 12, cursor: "pointer",
                  border: `1px solid ${COLORS.line}`,
                  background: fasting.days.includes(d) ? COLORS.gold : COLORS.bgRaised,
                  color: fasting.days.includes(d) ? "#1A130A" : COLORS.text,
                }}>{d}</button>
              ))}
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <Field label="Eating window start">
                <input style={inputStyle} type="time" value={fasting.windowStart}
                  onChange={(e) => { const n = { ...fasting, windowStart: e.target.value }; setFasting(n); sSet(`fasting:${me}`, n); }} />
              </Field>
              <Field label="Eating window end">
                <input style={inputStyle} type="time" value={fasting.windowEnd}
                  onChange={(e) => { const n = { ...fasting, windowEnd: e.target.value }; setFasting(n); sSet(`fasting:${me}`, n); }} />
              </Field>
            </div>
          </>
        )}
      </Card>

      <Card>
        <SectionTitle icon={Sparkles}>Your profile</SectionTitle>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <Field label="Height (cm)"><input style={inputStyle} type="number" value={profile.heightCm}
            onChange={(e) => setProfile({ ...profile, heightCm: e.target.value })} /></Field>
          <Field label="Age"><input style={inputStyle} type="number" value={profile.age}
            onChange={(e) => setProfile({ ...profile, age: e.target.value })} /></Field>
        </div>
        <Field label="Sex">
          <select style={inputStyle} value={profile.sex} onChange={(e) => setProfile({ ...profile, sex: e.target.value })}>
            <option value="female">Female</option><option value="male">Male</option>
          </select>
        </Field>
        <Field label="Activity level">
          <select style={inputStyle} value={profile.activity} onChange={(e) => setProfile({ ...profile, activity: e.target.value })}>
            <option value="sedentary">Sedentary</option>
            <option value="light">Light</option>
            <option value="moderate">Moderate</option>
            <option value="high">High</option>
            <option value="veryhigh">Very high (marathon/ultra training)</option>
          </select>
        </Field>
      </Card>

      <Btn full onClick={calcPlan} disabled={!goal.targetWeight || !goal.targetDate || busy}>
        {busy ? <Loader2 className="spin" size={16} /> : <Sparkles size={16} />} Work out my plan
      </Btn>

      {goal.plan && (
        <Card style={{ borderColor: COLORS.gold }}>
          <SectionTitle icon={Flame}>Your plan</SectionTitle>
          <div style={{ display: "flex", gap: 18, marginBottom: 10 }}>
            <Stat label="Daily target" value={`${goal.plan.dailyCalorieTarget} kcal`} color={COLORS.gold} />
            <Stat label="Weekly rate" value={`${goal.plan.weeklyRateKg} kg/wk`} />
            <Stat label="Protein" value={`${goal.plan.proteinTargetG}g`} />
          </div>
          <div style={{ fontSize: 13, color: COLORS.textDim }}>{goal.plan.notes}</div>
        </Card>
      )}
    </div>
  );
}

// ================= PROGRESS TAB =================
function ProgressTab({ me, partner }) {
  const [who, setWho] = useState(me);
  const [checks, setChecks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const keys = await sList(`bodycheck:${who}:`);
      const items = await Promise.all(keys.sort().reverse().map((k) => sGet(k)));
      setChecks(items.filter(Boolean));
      setLoading(false);
    })();
  }, [who]);

  return (
    <div style={{ display: "grid", gap: 14 }}>
      {partner && (
        <div style={{ display: "flex", gap: 8 }}>
          {[me, partner].map((n) => (
            <button key={n} onClick={() => setWho(n)} style={{
              flex: 1, padding: "10px", borderRadius: 10, cursor: "pointer",
              border: `1px solid ${COLORS.line}`,
              background: who === n ? COLORS.gold : COLORS.bgRaised,
              color: who === n ? "#1A130A" : COLORS.text, fontWeight: 600, fontSize: 13,
            }}>{n}</button>
          ))}
        </div>
      )}
      {loading && <Centered style={{ minHeight: 120 }}><Loader2 size={20} /></Centered>}
      {!loading && checks.length === 0 && (
        <Card><div style={{ color: COLORS.textDim, fontSize: 14 }}>No weekly check-ins yet.</div></Card>
      )}
      {checks.map((c, i) => (
        <Card key={i}>
          <div style={{ fontSize: 12, color: COLORS.textDim, marginBottom: 6 }}>{c.date ? fmtDate(c.date) : "This week"}</div>
          <div style={{ fontSize: 14, marginBottom: 8 }}>{c.summary}</div>
          <ul style={{ paddingLeft: 18, margin: 0 }}>
            {c.actions?.map((a, j) => <li key={j} style={{ fontSize: 13, marginBottom: 4 }}>{a}</li>)}
          </ul>
        </Card>
      ))}
    </div>
  );
}

// ================= COMPETE TAB =================
const MESSAGES = [
  (a, b) => `${a} is putting in the work today. ${b}, the ridge won't climb itself.`,
  (a, b) => `Neck and neck out there — ${a} and ${b} both on the trail.`,
  (a, b) => `${a}, your streak is looking sharp. Keep the pace.`,
  (a, b) => `Friendly reminder: bragging rights are on the line tonight.`,
  (a, b) => `${b} logged in already — ${a}, don't let the summit wait.`,
];

function CompeteTab({ me, partner }) {
  const [data, setData] = useState({ weight: [], steps: [], streaks: {} });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const people = partner ? [me, partner] : [me];
      const days = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(); d.setDate(d.getDate() - (6 - i));
        return d.toISOString().slice(0, 10);
      });
      const weightRows = [];
      const stepRows = [];
      const streaks = {};
      for (const day of days) {
        const row = { date: day.slice(5) };
        const srow = { date: day.slice(5) };
        for (const p of people) {
          const w = await sGet(`weighins:${p}:${day}`);
          const a = await sGet(`activity:${p}:${day}`);
          row[p] = w?.weight ?? null;
          srow[p] = a?.steps ? Number(a.steps) : null;
        }
        weightRows.push(row);
        stepRows.push(srow);
      }
      for (const p of people) {
        let streak = 0;
        for (let i = days.length - 1; i >= 0; i--) {
          const a = await sGet(`activity:${p}:${days[i]}`);
          if (a?.loggedComplete) streak++; else break;
        }
        streaks[p] = streak;
      }
      setData({ weight: weightRows, steps: stepRows, streaks, people });
      setLoading(false);
    })();
  }, [me, partner]);

  if (loading) return <Centered style={{ minHeight: 200 }}><Loader2 size={22} /></Centered>;

  const msg = partner ? MESSAGES[Math.floor(Math.random() * MESSAGES.length)](me, partner) : "Log daily to build your streak.";

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <Card style={{ background: `linear-gradient(135deg, ${COLORS.bgCard}, #2a2318)`, borderColor: COLORS.gold }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Trophy size={18} color={COLORS.gold} />
          <div style={{ fontSize: 13.5 }}>{msg}</div>
        </div>
      </Card>

      <div style={{ display: "flex", gap: 10 }}>
        <Card style={{ flex: 1, textAlign: "center" }}>
          <div style={{ fontSize: 24, fontWeight: 800, color: COLORS.personA }}>{data.streaks[me] || 0}</div>
          <div style={{ fontSize: 11, color: COLORS.textDim }}>{me}'s streak</div>
        </Card>
        {partner && (
          <Card style={{ flex: 1, textAlign: "center" }}>
            <div style={{ fontSize: 24, fontWeight: 800, color: COLORS.personB }}>{data.streaks[partner] || 0}</div>
            <div style={{ fontSize: 11, color: COLORS.textDim }}>{partner}'s streak</div>
          </Card>
        )}
      </div>

      <Card>
        <SectionTitle icon={TrendingUp}>Weight trend (7 days)</SectionTitle>
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={data.weight}>
            <CartesianGrid stroke={COLORS.line} strokeDasharray="3 3" />
            <XAxis dataKey="date" stroke={COLORS.textDim} fontSize={11} />
            <YAxis stroke={COLORS.textDim} fontSize={11} domain={["auto", "auto"]} />
            <Tooltip contentStyle={{ background: COLORS.bgRaised, border: `1px solid ${COLORS.line}` }} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Line type="monotone" dataKey={me} stroke={COLORS.personA} strokeWidth={2} connectNulls dot={{ r: 3 }} />
            {partner && <Line type="monotone" dataKey={partner} stroke={COLORS.personB} strokeWidth={2} connectNulls dot={{ r: 3 }} />}
          </LineChart>
        </ResponsiveContainer>
      </Card>

      <Card>
        <SectionTitle icon={Footprints}>Steps (7 days)</SectionTitle>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={data.steps}>
            <CartesianGrid stroke={COLORS.line} strokeDasharray="3 3" />
            <XAxis dataKey="date" stroke={COLORS.textDim} fontSize={11} />
            <YAxis stroke={COLORS.textDim} fontSize={11} />
            <Tooltip contentStyle={{ background: COLORS.bgRaised, border: `1px solid ${COLORS.line}` }} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey={me} fill={COLORS.personA} radius={[4,4,0,0]} />
            {partner && <Bar dataKey={partner} fill={COLORS.personB} radius={[4,4,0,0]} />}
          </BarChart>
        </ResponsiveContainer>
      </Card>
    </div>
  );
}
