"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import Modal from "@/components/Modal";
import { 
  Folder, Trash2, Upload, RefreshCw, 
  Wifi, ChevronRight, Search,
  Menu, Sun, Moon, Monitor, ChevronDown,
  FileText, Image as ImageIcon, Music, Video, Edit2,
  FileArchive, FileCode, FileSpreadsheet, FileType, FileJson,
  LogOut, ShieldCheck, Eye, EyeOff,
  Download, Link2, Copy, ArrowRightLeft, FolderOpen, Settings, X,
  Pause, Play, CircleX,
  Globe, BadgeInfo, Mail, BookOpen,
  FolderPlus,
  HardDrive,
} from "lucide-react";

type ThemeMode = "system" | "light" | "dark";

const THEME_STORE_KEY = "r2_admin_theme_v1";

type ToastKind = "success" | "error" | "info";
type ToastPayload = { kind: ToastKind; message: string; detail?: string };
type ToastState = ToastPayload | string | null;

const normalizeToast = (t: ToastState): ToastPayload | null => {
  if (!t) return null;
  if (typeof t === "string") {
    const msg = t.trim();
    const kind: ToastKind =
      /失败|错误|异常/.test(msg) ? "error" : /成功|已/.test(msg) ? "success" : "info";
    return { kind, message: msg };
  }
  return t;
};

const useMediaQuery = (query: string) => {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [query]);
  return matches;
};

const BrandMark = ({ className }: { className?: string }) => {
  const [failed, setFailed] = useState(false);
  if (!failed) {
    return (
      <img
        src="/brand.png"
        alt=""
        aria-hidden="true"
        className={["block object-contain", className].filter(Boolean).join(" ")}
        onError={() => setFailed(true)}
        draggable={false}
      />
    );
  }

  return (
    <div aria-hidden="true" className={className} />
  );
};

const BucketHintChip = ({
  bucketName,
  disabled,
  onClick,
  className,
}: {
  bucketName: string;
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
}) => {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      title={bucketName}
      aria-label="查看当前存储桶"
      className={[
        "inline-flex items-center gap-2 px-1 py-1 rounded-md text-left",
        "transition-colors hover:text-gray-700 dark:hover:text-gray-200",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-900",
        "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:text-inherit",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <HardDrive
        className="w-5 h-5 text-gray-500 shrink-0 dark:text-gray-300"
        strokeWidth={1.75}
      />
      <div className="min-w-0">
        <div className="text-[10px] leading-tight text-gray-500 dark:text-gray-400">当前桶</div>
        <div className="mt-0.5 text-[11px] leading-tight font-normal text-blue-600 truncate max-w-[10.5rem] md:max-w-[16rem] dark:text-blue-300">
          {bucketName}
        </div>
      </div>
    </button>
  );
};

// --- 类型定义 ---
type Bucket = { id: string; Name: string; CreationDate: string; transferMode?: "presigned" | "proxy" | "presigned_needs_bucket_name" };
type FileItem = {
  name: string;
  key: string;
  type: "folder" | "file";
  size?: number;
  lastModified?: string;
};
type AdminAuth = { username?: string; password: string };
type BucketUsage = {
  bucket: string;
  prefix: string;
  objects: number;
  bytes: number;
  pagesScanned: number;
  truncated: boolean;
};
type AccountUsage = {
  buckets: number;
  objects: number;
  bytes: number;
  truncatedBuckets: number;
};
type LinkConfig = {
  publicBaseUrl?: string;
  customBaseUrl?: string;
  s3BucketName?: string;
};
type LinkConfigMap = Record<string, LinkConfig>;
type PreviewState =
  | null
  | {
      name: string;
      key: string;
      bucket: string;
      kind: "image" | "video" | "audio" | "text" | "pdf" | "office" | "other";
      url: string;
      text?: string;
    };
type PreviewKind = NonNullable<PreviewState>["kind"];

type UploadStatus = "queued" | "uploading" | "paused" | "done" | "error" | "canceled";
type MultipartUploadState = {
  uploadId: string;
  partSize: number;
  parts: Record<string, string>; // partNumber -> etag
};
type UploadTask = {
  id: string;
  bucket: string;
  file: File;
  key: string;
  resumeKey?: string;
  multipart?: MultipartUploadState;
  startedAt?: number;
  loaded: number;
  speedBps: number;
  status: UploadStatus;
  error?: string;
};

// --- 辅助函数 ---
const formatSize = (bytes?: number) => {
  if (bytes === undefined) return "-";
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};

const LOGIN_PAGE = {
  title: "Qing's R2 Admin",
  subtitle: "R2对象存储多功能管理工具",
  advantages: [
    "极速的响应速度和上传下载速度",
    "无服务器部署、不存储用户数据",
    "支持大文件上传、预览、重命名、移动和批量操作等功能",
  ],
  announcementTitle: "公告",
  announcementText: `欢迎使用

- 继续访问即代表您已阅读并同意「关于页面」相关条款。
- 如有问题欢迎通过「电子邮件」与我反馈沟通。
`,
  footer: "By Wang Qing",
};

const LOGIN_LINKS = [
  { label: "我的博客", href: "https://qinghub.top", icon: "globe" as const },
  { label: "使用教程", href: "https://github.com/wangqing176176-a11y/qing-r2-cloudy", icon: "book" as const },
  { label: "关于页面", href: "https://qinghub.top/about/", icon: "about" as const },
  { label: "电子邮箱", href: "mailto:wangqing176176@gmail.com", icon: "mail" as const },
] as const;

type MultipartResumeRecord = {
  bucket: string;
  key: string;
  size: number;
  lastModified: number;
  name: string;
  uploadId: string;
  partSize: number;
  parts: Record<string, string>; // partNumber -> etag
};

const RESUME_STORE_KEY = "r2_multipart_resume_v1";

const getResumeKey = (bucket: string, key: string, file: File) =>
  `${bucket}|${key}|${file.size}|${file.lastModified}`;

const loadResumeStore = (): Record<string, MultipartResumeRecord> => {
  try {
    const raw = localStorage.getItem(RESUME_STORE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, MultipartResumeRecord>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
};

const saveResumeStore = (next: Record<string, MultipartResumeRecord>) => {
  localStorage.setItem(RESUME_STORE_KEY, JSON.stringify(next));
};

const loadResumeRecord = (resumeKey: string): MultipartResumeRecord | null => {
  const store = loadResumeStore();
  const rec = store[resumeKey];
  return rec && typeof rec === "object" ? rec : null;
};

const upsertResumeRecord = (resumeKey: string, rec: MultipartResumeRecord) => {
  const store = loadResumeStore();
  store[resumeKey] = rec;
  saveResumeStore(store);
};

const deleteResumeRecord = (resumeKey: string) => {
  const store = loadResumeStore();
  if (!(resumeKey in store)) return;
  delete store[resumeKey];
  saveResumeStore(store);
};

export default function R2Admin() {
  // --- 状态管理 ---
  const [auth, setAuth] = useState<AdminAuth | null>(null);
  const [buckets, setBuckets] = useState<Bucket[]>([]);
  const [selectedBucket, setSelectedBucket] = useState<string | null>(null);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [path, setPath] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<"checking" | "connected" | "unbound" | "error">("checking");
  const [connectionDetail, setConnectionDetail] = useState<string | null>(null);
  const [authRequired, setAuthRequired] = useState(false);
  const [bucketUsage, setBucketUsage] = useState<BucketUsage | null>(null);
  const [usageLoading, setUsageLoading] = useState(false);
  const [accountUsage, setAccountUsage] = useState<AccountUsage | null>(null);
  const [accountUsageLoading, setAccountUsageLoading] = useState(false);
  const [selectedItem, setSelectedItem] = useState<FileItem | null>(null);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [preview, setPreview] = useState<PreviewState>(null);
  const [uploadPanelOpen, setUploadPanelOpen] = useState(false);
  const [uploadTasks, setUploadTasks] = useState<UploadTask[]>([]);
  const [uploadQueuePaused, setUploadQueuePaused] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<FileItem[]>([]);
  const [searchCursor, setSearchCursor] = useState<string | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [linkConfigMap, setLinkConfigMap] = useState<LinkConfigMap>({});

  const [toast, setToast] = useState<ToastState>(null);
  const toastPayload = useMemo(() => normalizeToast(toast), [toast]);

  const isMobile = useMediaQuery("(max-width: 767px)");
  const prefersDark = useMediaQuery("(prefers-color-scheme: dark)");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);

  const [loginAnnouncementOpen, setLoginAnnouncementOpen] = useState(false);

  const bucketMenuRef = useRef<HTMLDivElement>(null);
  const [bucketMenuOpen, setBucketMenuOpen] = useState(false);

  const [themeMode, setThemeMode] = useState<ThemeMode>("system");
  const [resolvedDark, setResolvedDark] = useState(false);

  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState("");

  const [moveOpen, setMoveOpen] = useState(false);
  const [moveMode, setMoveMode] = useState<"move" | "copy">("move");
  const [moveTarget, setMoveTarget] = useState("");
  const [moveSources, setMoveSources] = useState<string[]>([]);

  const [mkdirOpen, setMkdirOpen] = useState(false);
  const [mkdirName, setMkdirName] = useState("");

  const [linkOpen, setLinkOpen] = useState(false);
  const [linkPublic, setLinkPublic] = useState("");
  const [linkCustom, setLinkCustom] = useState("");
  const [linkS3BucketName, setLinkS3BucketName] = useState("");

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [bucketHintOpen, setBucketHintOpen] = useState(false);

  const uploadTasksRef = useRef<UploadTask[]>([]);
  const uploadProcessingRef = useRef(false);
  const uploadControllersRef = useRef<Map<string, AbortController>>(new Map());
  const uploadQueuePausedRef = useRef(false);

  useEffect(() => {
    uploadTasksRef.current = uploadTasks;
  }, [uploadTasks]);

  useEffect(() => {
    uploadQueuePausedRef.current = uploadQueuePaused;
  }, [uploadQueuePaused]);

  // 登录表单状态
  const [formUsername, setFormUsername] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [showSecret, setShowSecret] = useState(false);

  // --- 初始化 ---
  useEffect(() => {
    const stored = localStorage.getItem("admin_password");
    const storedUser = localStorage.getItem("admin_username");
    if (stored) setAuth({ password: stored, ...(storedUser ? { username: storedUser } : {}) });
    if (stored) setRememberMe(true);

    if (storedUser) setFormUsername(storedUser);

    const storedLinks = localStorage.getItem("r2_link_config_v1");
    if (storedLinks) {
      try {
        setLinkConfigMap(JSON.parse(storedLinks));
      } catch {
        localStorage.removeItem("r2_link_config_v1");
      }
    }
  }, []);

  useEffect(() => {
    const t = toastPayload;
    if (!t) return;
    const ms = t.kind === "error" ? 4500 : 3200;
    const timer = setTimeout(() => setToast(null), ms);
    return () => clearTimeout(timer);
  }, [toastPayload]);

  const ToastView = toastPayload ? (
    <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 max-w-[92vw]">
      <div
        className={`inline-flex items-center gap-2 px-4 py-2 rounded-full border shadow-lg text-sm font-medium ${
          toastPayload.kind === "success"
            ? "bg-green-50 border-green-200 text-green-700 dark:bg-green-950/40 dark:border-green-900 dark:text-green-200"
            : toastPayload.kind === "error"
              ? "bg-red-50 border-red-200 text-red-700 dark:bg-red-950/40 dark:border-red-900 dark:text-red-200"
              : "bg-gray-900 text-white border-gray-900 dark:bg-gray-900 dark:border-gray-800"
        }`}
        role="status"
        aria-live="polite"
      >
        <span className="shrink-0 flex items-center justify-center">
          {toastPayload.kind === "success" ? (
            <ShieldCheck className="w-5 h-5" />
          ) : toastPayload.kind === "error" ? (
            <CircleX className="w-5 h-5" />
          ) : (
            <BadgeInfo className="w-5 h-5" />
          )}
        </span>
        <span className="leading-none">{toastPayload.message}</span>
      </div>
    </div>
  ) : null;

  useEffect(() => {
    if (!authRequired) return;
    setLoginAnnouncementOpen(!isMobile);
  }, [authRequired, isMobile]);

  useEffect(() => {
    if (!bucketMenuOpen) return;
    const onDown = (e: Event) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (bucketMenuRef.current && bucketMenuRef.current.contains(target)) return;
      setBucketMenuOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown, { passive: true });
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
    };
  }, [bucketMenuOpen]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(THEME_STORE_KEY);
      if (stored === "light" || stored === "dark" || stored === "system") setThemeMode(stored);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    const isDark = themeMode === "dark" || (themeMode === "system" && prefersDark);
    setResolvedDark(isDark);
    document.documentElement.classList.toggle("dark", isDark);
    try {
      const themeMeta = document.querySelector('meta[name="theme-color"]');
      if (themeMeta) themeMeta.setAttribute("content", isDark ? "#111827" : "#f9fafb");
    } catch {
      // ignore
    }
    try {
      localStorage.setItem(THEME_STORE_KEY, themeMode);
    } catch {
      // ignore
    }
  }, [prefersDark, themeMode]);

  useEffect(() => {
    if (!isMobile) {
      setMobileNavOpen(false);
      setMobileDetailOpen(false);
    }
  }, [isMobile]);

  // 移动端详情弹窗只由“操作”按钮触发，不跟随选中项自动弹出。

  useEffect(() => {
    fetchBuckets();
  }, [auth]);

  // --- 核心：带鉴权的 Fetch ---
	  const fetchWithAuth = async (url: string, options: RequestInit = {}) => {
	    const headers: Record<string, string> = {
	      ...(options.headers as Record<string, string> | undefined),
	    };
	    if (!headers["content-type"] && typeof options.body === "string") headers["content-type"] = "application/json";
	    if (auth?.username) headers["x-admin-username"] = auth.username;
	    if (auth?.password) headers["x-admin-password"] = auth.password;
	    return fetch(url, { ...options, headers });
	  };

	  const readJsonSafe = async (res: Response) => {
	    try {
	      return await res.clone().json();
	    } catch {
	      const text = await res
	        .clone()
	        .text()
	        .catch(() => "");
	      return text ? { error: text } : {};
	    }
	  };

  // --- 登录逻辑（可选 ADMIN_PASSWORD） ---
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const pw = formPassword.trim();
    const user = formUsername.trim();
    const nextAuth: AdminAuth | null = pw ? { password: pw, username: user || undefined } : null;

    try {
      setLoading(true);
      const res = await fetch("/api/buckets", {
        headers: nextAuth?.password
          ? {
              ...(nextAuth?.username ? { "x-admin-username": nextAuth.username } : {}),
              "x-admin-password": nextAuth.password,
            }
          : undefined,
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) {
        setToast("账号或密码错误 请重试！");
        return;
      }
      if (!res.ok) throw new Error(data.error || "Failed");

      setAuth(nextAuth);
      if (rememberMe) {
        if (nextAuth?.password) localStorage.setItem("admin_password", nextAuth.password);
        else localStorage.removeItem("admin_password");
        if (nextAuth?.username) localStorage.setItem("admin_username", nextAuth.username);
        else localStorage.removeItem("admin_username");
      } else {
        localStorage.removeItem("admin_password");
        localStorage.removeItem("admin_username");
      }
      setAuthRequired(false);
      setBuckets(data.buckets || []);
      if (!selectedBucket && data.buckets?.length) setSelectedBucket(data.buckets[0].id);
      setConnectionStatus((data.buckets?.length ?? 0) > 0 ? "connected" : "unbound");
      setConnectionDetail((data.buckets?.length ?? 0) > 0 ? null : "未绑定存储桶：请在 Cloudflare Pages 设置中绑定 R2 存储桶");
      setToast("登陆成功");
    } catch {
      setToast("登陆失败");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("admin_password");
    localStorage.removeItem("admin_username");
    setAuth(null);
    setBuckets([]);
    setSelectedBucket(null);
    setBucketUsage(null);
    setAccountUsage(null);
    setSelectedItem(null);
    setSelectedKeys(new Set());
    setPreview(null);
    setUploadTasks([]);
    setUploadPanelOpen(false);
    setUploadQueuePaused(false);
    setRenameOpen(false);
    setMoveOpen(false);
    setLinkOpen(false);
    setDeleteOpen(false);
    setAuthRequired(true);
    setConnectionStatus("error");
    setConnectionDetail("已退出登录，请重新输入管理账号和密码");
    setFormUsername("");
    setFormPassword("");
    setRememberMe(false);
    setLoading(false);
    setToast("退出登录成功");
  };

  // --- API 调用 ---
  const fetchBuckets = async () => {
    setConnectionStatus("checking");
    setConnectionDetail(null);
    try {
      const res = await fetchWithAuth("/api/buckets");
      const data = await res.json().catch(() => ({}));

      if (res.status === 401) {
        setAuthRequired(true);
        setConnectionStatus("error");
        setConnectionDetail("请刷新存储桶列表！");
        return;
      }

      if (res.ok && data.buckets) {
        setAuthRequired(false);
        setBuckets(data.buckets);
        if (data.buckets.length === 0) {
          setSelectedBucket(null);
          setFiles([]);
          setPath([]);
          setConnectionStatus("unbound");
          setConnectionDetail("未绑定存储桶：请在 Cloudflare Pages 设置中绑定 R2 存储桶");
        } else {
          setConnectionStatus("connected");
          if (data.buckets.length > 0 && !selectedBucket) {
            setSelectedBucket(data.buckets[0].id);
          }
        }
      } else {
        setConnectionStatus("error");
        if (data.error) setConnectionDetail(String(data.error));
        if (data.error) setToast(`连接失败: ${data.error}`);
      }
    } catch (e) {
      setConnectionStatus("error");
      setConnectionDetail("网络或运行时异常");
      console.error(e);
    }
  };

  const fetchFiles = async (bucketName: string, currentPath: string[]) => {
    if (!bucketName) return;
    setLoading(true);
    const prefix = currentPath.length > 0 ? currentPath.join("/") + "/" : "";
    try {
      const res = await fetchWithAuth(`/api/files?bucket=${encodeURIComponent(bucketName)}&prefix=${encodeURIComponent(prefix)}`);
      const data = await res.json();
      setFiles(data.items || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const runGlobalSearch = async (bucketName: string, term: string) => {
    const q = term.trim();
    if (!q) {
      setSearchResults([]);
      setSearchCursor(null);
      return;
    }
    setSearchLoading(true);
    try {
      const res = await fetchWithAuth(
        `/api/search?bucket=${encodeURIComponent(bucketName)}&q=${encodeURIComponent(q)}&limit=200`,
      );
      const data = await res.json();
      if (res.ok) {
        setSearchResults(data.items || []);
        setSearchCursor(data.cursor ?? null);
      } else {
        setSearchResults([]);
        setSearchCursor(null);
      }
    } finally {
      setSearchLoading(false);
    }
  };

  const fetchBucketUsage = async (bucketName: string) => {
    setUsageLoading(true);
    try {
      const res = await fetchWithAuth(`/api/usage?bucket=${encodeURIComponent(bucketName)}&maxPages=10`);
      const data = await res.json();
      if (res.ok) setBucketUsage(data);
      else setBucketUsage(null);
    } catch {
      setBucketUsage(null);
    } finally {
      setUsageLoading(false);
    }
  };

  useEffect(() => {
    if (selectedBucket) {
      fetchFiles(selectedBucket, path);
      setSelectedItem(null);
      setSelectedKeys(new Set());
    }
  }, [selectedBucket, path, auth]);

  useEffect(() => {
    if (!selectedBucket) {
      setSearchResults([]);
      setSearchCursor(null);
      return;
    }
    const term = searchTerm.trim();
    if (!term) {
      setSearchResults([]);
      setSearchCursor(null);
      return;
    }
    const t = setTimeout(() => {
      runGlobalSearch(selectedBucket, term).catch(() => {});
    }, 250);
    return () => clearTimeout(t);
  }, [searchTerm, selectedBucket, auth]);

  useEffect(() => {
    if (selectedBucket) {
      fetchBucketUsage(selectedBucket);
    }
  }, [selectedBucket, auth]);

  const fetchAccountUsageTotal = async (bucketList: Bucket[]) => {
    if (!bucketList.length) {
      setAccountUsage(null);
      return;
    }
    setAccountUsageLoading(true);
    try {
      let objects = 0;
      let bytes = 0;
      let truncatedBuckets = 0;

      const concurrency = 2;
      let index = 0;
      const worker = async () => {
        for (;;) {
          const i = index++;
          if (i >= bucketList.length) break;
          const name = bucketList[i].id;
          const res = await fetchWithAuth(`/api/usage?bucket=${encodeURIComponent(name)}&maxPages=10`);
          const data = await res.json();
          if (res.ok) {
            objects += data.objects ?? 0;
            bytes += data.bytes ?? 0;
            if (data.truncated) truncatedBuckets += 1;
          }
        }
      };

      await Promise.all(Array.from({ length: Math.min(concurrency, bucketList.length) }, worker));
      setAccountUsage({ buckets: bucketList.length, objects, bytes, truncatedBuckets });
    } catch {
      setAccountUsage(null);
    } finally {
      setAccountUsageLoading(false);
    }
  };

  useEffect(() => {
    if (buckets.length) {
      fetchAccountUsageTotal(buckets);
    } else {
      setAccountUsage(null);
    }
  }, [buckets, auth]);

  const persistLinkConfigMap = (next: LinkConfigMap) => {
    setLinkConfigMap(next);
    localStorage.setItem("r2_link_config_v1", JSON.stringify(next));
  };

  const getLinkConfig = (bucketName: string | null): LinkConfig => {
    if (!bucketName) return {};
    return linkConfigMap[bucketName] ?? {};
  };

  const normalizeBaseUrl = (raw?: string) => {
    if (!raw) return undefined;
    const trimmed = raw.trim();
    if (!trimmed) return undefined;
    const withProto = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    return withProto.endsWith("/") ? withProto : `${withProto}/`;
  };

  const buildObjectUrl = (baseUrl: string | undefined, key: string) => {
    if (!baseUrl) return null;
    return baseUrl + key.split("/").map(encodeURIComponent).join("/");
  };

  const getFileExt = (name: string) => {
    const base = name.split("?")[0];
    const parts = base.split("/");
    const last = parts[parts.length - 1] || "";
    const idx = last.lastIndexOf(".");
    if (idx <= 0 || idx === last.length - 1) return "";
    return last.slice(idx + 1).toLowerCase();
  };

  const getFileTag = (item: FileItem) => {
    if (item.type === "folder") return "DIR";
    const ext = getFileExt(item.name);
    return ext ? ext.toUpperCase() : "FILE";
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.left = "-9999px";
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }
    setToast("已复制到剪贴板");
  };

  // --- 操作逻辑 ---
  const handleEnterFolder = (folderName: string) => {
    setPath([...path, folderName]);
    setSearchTerm("");
  };

  const handleBreadcrumbClick = (index: number) => {
    setPath(path.slice(0, index + 1));
    setSearchTerm("");
  };

  const refreshCurrentView = async () => {
    if (!selectedBucket) return;
    const term = searchTerm.trim();
    if (term) await runGlobalSearch(selectedBucket, term);
    else await fetchFiles(selectedBucket, path);
  };

  const openMkdir = () => {
    if (!selectedBucket) return;
    setMkdirName("");
    setMkdirOpen(true);
  };

  const executeMkdir = async () => {
    if (!selectedBucket) return;
    const name = mkdirName.trim();
    if (!name) {
      setMkdirOpen(false);
      return;
    }
    if (name.includes("/")) {
      setToast("文件夹名不支持 /");
      return;
    }
    const prefix = path.length > 0 ? path.join("/") + "/" : "";
    try {
      setLoading(true);
      const res = await fetchWithAuth("/api/operate", {
        method: "POST",
        body: JSON.stringify({
          bucket: selectedBucket,
          targetKey: `${prefix}${name}/`,
          operation: "mkdir",
        }),
      });
      if (!res.ok) throw new Error("mkdir failed");
      setMkdirOpen(false);
      setSearchTerm("");
      await fetchFiles(selectedBucket, path);
      setToast("新建文件夹成功");
    } catch {
      setToast("新建文件夹失败，请重试");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = () => {
    if (!selectedBucket) return;
    if (selectedKeys.size === 0 && !selectedItem) return;
    setDeleteOpen(true);
  };

  const executeDelete = async () => {
    if (!selectedBucket) return;
    try {
      setLoading(true);
      const selected = Array.from(selectedKeys);
      if (selected.length > 0) {
        const res = await fetchWithAuth("/api/operate", {
          method: "POST",
          body: JSON.stringify({
            bucket: selectedBucket,
            sourceKeys: selected,
            operation: "deleteMany",
          }),
        });
        if (!res.ok) throw new Error("delete failed");
      } else if (selectedItem) {
        if (selectedItem.type === "folder") {
          const res = await fetchWithAuth("/api/operate", {
            method: "POST",
            body: JSON.stringify({
              bucket: selectedBucket,
              sourceKey: selectedItem.key,
              operation: "delete",
            }),
          });
          if (!res.ok) throw new Error("delete failed");
        } else {
          const res = await fetchWithAuth(
            `/api/files?bucket=${selectedBucket}&key=${encodeURIComponent(selectedItem.key)}`,
            { method: "DELETE" },
          );
          if (!res.ok) throw new Error("delete failed");
        }
      } else {
        setDeleteOpen(false);
        return;
      }

      setDeleteOpen(false);
      await refreshCurrentView();
      setSelectedItem(null);
      setSelectedKeys(new Set());
      setToast("删除成功");
    } catch {
      setToast("删除失败，请刷新后重试");
    } finally {
      setLoading(false);
    }
  };

  const handleRename = () => {
    if (!selectedBucket || !selectedItem) return;
    setRenameValue(selectedItem.name);
    setRenameOpen(true);
  };

  const openRenameForSelection = () => {
    if (!selectedBucket) return;
    const keys = Array.from(selectedKeys);
    if (keys.length !== 1) {
      setToast("请选择 1 个文件/文件夹进行重命名");
      return;
    }
    const item = filteredFiles.find((f) => f.key === keys[0]);
    if (!item) {
      setToast("未找到选中文件");
      return;
    }
    openRenameFor(item);
  };

  const handleRenameFromToolbar = () => {
    if (!selectedBucket) return;
    if (selectedKeys.size === 1) {
      openRenameForSelection();
      return;
    }
    if (selectedItem) {
      handleRename();
      return;
    }
    setToast("请选择 1 个文件/文件夹进行重命名");
  };

  const openRenameFor = (item: FileItem) => {
    if (!selectedBucket) return;
    setSelectedItem(item);
    setRenameValue(item.name);
    setRenameOpen(true);
  };

  const executeRename = async () => {
    if (!selectedBucket || !selectedItem) return;
    const newName = renameValue.trim();
    if (!newName || newName === selectedItem.name) {
      setRenameOpen(false);
      return;
    }

    const currentKey = selectedItem.key;
    let prefix = "";
    if (selectedItem.type === "folder") {
      const trimmed = currentKey.endsWith("/") ? currentKey.slice(0, -1) : currentKey;
      const parts = trimmed.split("/").filter(Boolean);
      prefix = parts.length > 1 ? `${parts.slice(0, -1).join("/")}/` : "";
    } else {
      const parts = currentKey.split("/").filter(Boolean);
      prefix = parts.length > 1 ? `${parts.slice(0, -1).join("/")}/` : "";
    }
    const targetKey = prefix + newName + (selectedItem.type === "folder" ? "/" : "");

    try {
      setLoading(true);
      const res = await fetchWithAuth("/api/operate", {
        method: "POST",
        body: JSON.stringify({
          bucket: selectedBucket,
          sourceKey: selectedItem.key,
          targetKey,
          operation: "move",
        }),
      });
      if (!res.ok) throw new Error("rename failed");
      setRenameOpen(false);
      await refreshCurrentView();
      setSelectedItem(null);
      setSelectedKeys(new Set());
      setToast("重命名成功");
    } catch {
      setToast("重命名失败，请刷新后重试");
    } finally {
      setLoading(false);
    }
  };

  const handleMoveOrCopy = (mode: "move" | "copy") => {
    if (!selectedBucket || !selectedItem) return;
    setMoveMode(mode);
    const defaultDest = path.length ? path.join("/") + "/" : "";
    setMoveTarget(defaultDest);
    setMoveSources([selectedItem.key]);
    setMoveOpen(true);
  };

  const openMoveFor = (item: FileItem, mode: "move" | "copy") => {
    if (!selectedBucket) return;
    setSelectedItem(item);
    setMoveMode(mode);
    const defaultDest = path.length ? path.join("/") + "/" : "";
    setMoveTarget(defaultDest);
    setMoveSources([item.key]);
    setMoveOpen(true);
  };

  const openBatchMove = () => {
    if (!selectedBucket) return;
    const keys = Array.from(selectedKeys).filter((k) => !k.endsWith("/"));
    if (!keys.length) {
      setToast("暂不支持文件夹整体移动");
      return;
    }
    setMoveMode("move");
    const defaultDest = path.length ? path.join("/") + "/" : "";
    setMoveTarget(defaultDest);
    setMoveSources(keys);
    setMoveOpen(true);
  };

  const executeMoveOrCopy = async () => {
    if (!selectedBucket) return;
    const input = moveTarget.trim();
    if (!input) {
      setMoveOpen(false);
      return;
    }

    let cleaned = input;
    if (cleaned.startsWith("/")) cleaned = cleaned.slice(1);

    const sources = moveSources.length ? moveSources : selectedItem ? [selectedItem.key] : [];
    if (!sources.length) return;

    try {
      setLoading(true);
      const op = moveMode === "move" ? "move" : "copy";
      const manyOp = op === "move" ? "moveMany" : "copyMany";
      const useMany = sources.length > 1 || !selectedItem || sources[0] !== selectedItem.key;

      const res =
        useMany
          ? await fetchWithAuth("/api/operate", {
              method: "POST",
              body: JSON.stringify({
                bucket: selectedBucket,
                sourceKeys: sources,
                targetPrefix: cleaned,
                operation: manyOp,
              }),
            })
          : await fetchWithAuth("/api/operate", {
              method: "POST",
              body: JSON.stringify({
                bucket: selectedBucket,
                sourceKey: selectedItem.key,
                targetKey: (() => {
                  const suffix = selectedItem.type === "folder" ? "/" : "";
                  let targetKey = cleaned;
                  if (cleaned.endsWith("/")) targetKey = cleaned + selectedItem.name + suffix;
                  else if (selectedItem.type === "folder" && !targetKey.endsWith("/")) targetKey += "/";
                  return targetKey;
                })(),
                operation: op,
              }),
            });
      if (!res.ok) throw new Error("operate failed");
      setMoveOpen(false);
      setMoveSources([]);
      await refreshCurrentView();
      setSelectedItem(null);
      setSelectedKeys(new Set());
      setToast(moveMode === "move" ? "已移动" : "已复制");
    } catch {
      setToast(moveMode === "move" ? "移动失败" : "复制失败");
    } finally {
      setLoading(false);
    }
  };

  const getSignedDownloadUrl = async (bucket: string, key: string, filename?: string) => {
    const qs = new URLSearchParams();
    qs.set("bucket", bucket);
    qs.set("key", key);
    if (filename) qs.set("filename", filename);
    const cfg = getLinkConfig(bucket);
    if (cfg.s3BucketName) qs.set("bucketName", cfg.s3BucketName);
    const res = await fetchWithAuth(`/api/download?${qs.toString()}`);
    const data = await res.json();
    if (!res.ok || !data.url) throw new Error(data.error || "download url failed");
    return data.url as string;
  };

  const getSignedDownloadUrlForced = async (bucket: string, key: string, filename: string) => {
    const cfg = getLinkConfig(bucket);
    const extra = cfg.s3BucketName ? `&bucketName=${encodeURIComponent(cfg.s3BucketName)}` : "";
    const res = await fetchWithAuth(
      `/api/download?bucket=${encodeURIComponent(bucket)}&key=${encodeURIComponent(key)}&download=1&filename=${encodeURIComponent(filename)}${extra}`,
    );
    const data = await res.json();
    if (!res.ok || !data.url) throw new Error(data.error || "download url failed");
    return data.url as string;
  };

  const downloadItem = async (item: FileItem) => {
    if (!selectedBucket) return;
    if (item.type === "folder") {
      setToast("文件夹打包下载下一步做（当前先支持文件下载）");
      return;
    }
    try {
      const url = await getSignedDownloadUrlForced(selectedBucket, item.key, item.name);
      triggerDownloadUrl(url, item.name);
      setToast("已拉起下载");
    } catch {
      setToast("下载失败");
    }
  };

  const triggerDownloadUrl = (url: string, filename: string) => {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.rel = "noreferrer";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleBatchDownload = async () => {
    if (!selectedBucket) return;
    const keys = Array.from(selectedKeys).filter((k) => !k.endsWith("/"));
    if (!keys.length) {
      setToast("暂不支持文件夹整体批量下载");
      return;
    }
    setToast(`开始下载 ${keys.length} 个文件`);
    for (const k of keys) {
      try {
        const filename = k.split("/").pop() || "download";
        const url = await getSignedDownloadUrlForced(selectedBucket, k, filename);
        triggerDownloadUrl(url, filename);
        await new Promise((r) => setTimeout(r, 150));
      } catch {
        // ignore and continue
      }
    }
    setToast("已拉起批量下载");
  };

  const handleConfigureLinks = () => {
    if (!selectedBucket) return;
    const current = getLinkConfig(selectedBucket);
    setLinkPublic(current.publicBaseUrl ?? "");
    setLinkCustom(current.customBaseUrl ?? "");
    setLinkS3BucketName(current.s3BucketName ?? "");
    setLinkOpen(true);
  };

  const saveLinkConfig = () => {
    if (!selectedBucket) return;
    const publicBaseUrl = normalizeBaseUrl(linkPublic || undefined);
    const customBaseUrl = normalizeBaseUrl(linkCustom || undefined);
    const s3BucketName = linkS3BucketName.trim() || undefined;
    const next: LinkConfigMap = { ...linkConfigMap, [selectedBucket]: { publicBaseUrl, customBaseUrl, s3BucketName } };
    persistLinkConfigMap(next);
    setLinkOpen(false);
    setToast("已保存链接设置");
  };

  const copyLinkForItem = async (item: FileItem, kind: "public" | "custom") => {
    if (!selectedBucket) return;
    const cfg = getLinkConfig(selectedBucket);
    const baseUrl = kind === "public" ? cfg.publicBaseUrl : cfg.customBaseUrl;
    const url = buildObjectUrl(baseUrl, item.key);
    if (!url) {
      setToast(kind === "public" ? "未配置公共开发 URL" : "未配置自定义域名");
      return;
    }
    await copyToClipboard(url);
  };

  const previewItem = async (item: FileItem) => {
    if (!selectedBucket) return;
    if (item.type === "folder") return;

	    const lower = item.name.toLowerCase();
	    const ext = getFileExt(item.name);
	    let kind: PreviewKind = "other";
	    if (ext === "pdf") kind = "pdf";
	    else if (/^(doc|docx|ppt|pptx|xls|xlsx)$/.test(ext)) kind = "office";
	    else if (/\.(png|jpg|jpeg|gif|webp|svg)$/.test(lower)) kind = "image";
	    else if (/\.(mp4|mov|mkv|webm)$/.test(lower)) kind = "video";
	    else if (/\.(mp3|wav|flac|ogg)$/.test(lower)) kind = "audio";
	    else if (/\.(txt|log|md|json|csv|ts|tsx|js|jsx|css|html|xml|yml|yaml)$/.test(lower)) kind = "text";

    try {
      const url = await getSignedDownloadUrl(selectedBucket, item.key, item.name);
      const next: PreviewState = { name: item.name, key: item.key, bucket: selectedBucket, kind, url };
      setPreview(next);
      if (kind === "text") {
        const res = await fetch(url, { headers: { Range: "bytes=0-204799" } });
        const text = await res.text();
        setPreview((prev) => (prev && prev.key === item.key ? { ...prev, text } : prev));
      }
    } catch {
      setToast("预览失败");
    }
  };

  const formatSpeed = (bytesPerSec: number) => {
    if (!Number.isFinite(bytesPerSec) || bytesPerSec <= 0) return "-";
    return `${formatSize(bytesPerSec)}/s`;
  };

  const xhrPut = (
    url: string,
    body: Blob,
    contentType: string | undefined,
    onProgress: (loaded: number, total: number) => void,
    signal?: AbortSignal,
  ) => {
    return new Promise<{ etag: string | null }>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("PUT", url, true);
      xhr.setRequestHeader("Content-Type", contentType || "application/octet-stream");

      if (signal) {
        if (signal.aborted) {
          reject(new Error("Aborted"));
          return;
        }
        const onAbort = () => {
          try {
            xhr.abort();
          } catch {
            // ignore
          }
        };
        signal.addEventListener("abort", onAbort, { once: true });
        xhr.addEventListener(
          "loadend",
          () => {
            signal.removeEventListener("abort", onAbort);
          },
          { once: true },
        );
      }

      xhr.upload.onprogress = (evt) => {
        if (evt.lengthComputable) onProgress(evt.loaded, evt.total);
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve({ etag: xhr.getResponseHeader("ETag") });
        } else {
          reject(new Error(`Upload failed: ${xhr.status}`));
        }
      };
      xhr.onerror = () => reject(new Error("Network error"));
      xhr.onabort = () => reject(new Error("Aborted"));
      xhr.send(body);
    });
  };

  const uploadSingleFile = async (
    _taskId: string,
    bucket: string,
    key: string,
    file: File,
    onLoaded: (loaded: number) => void,
    signal?: AbortSignal,
	  ) => {
	    let signRes: Response;
	    try {
	      signRes = await fetchWithAuth("/api/files", {
	        method: "POST",
	        body: JSON.stringify({ bucket, key, contentType: file.type }),
	      });
	    } catch (err: unknown) {
	      const msg = err instanceof Error ? err.message : String(err);
	      throw new Error(`Failed to fetch (POST /api/files): ${msg}`);
	    }
	    const signData = await readJsonSafe(signRes);
	    if (!signRes.ok || !signData.url) throw new Error(signData.error || `sign failed (/api/files ${signRes.status})`);
	    await xhrPut(signData.url, file, file.type, (loaded) => onLoaded(loaded), signal);
	  };

  const uploadMultipartFile = async (
    taskId: string,
    bucket: string,
    key: string,
    file: File,
    onLoaded: (loaded: number) => void,
    signal?: AbortSignal,
  ) => {
    // R2 multipart parts should be >= 5MiB (except the last part). Choose a part size that
    // yields a few parts even for medium files, so we can upload parts in parallel and improve
    // throughput on networks where a single connection is slow.
    const pickPartSize = (size: number) => {
      const MiB = 1024 * 1024;
      const min = 8 * MiB;
      const max = 64 * MiB;
      const targetParts = 6;
      const raw = Math.ceil(size / targetParts);
      const clamped = Math.max(min, Math.min(max, raw));
      // Round up to whole MiB to avoid odd sizes.
      return Math.ceil(clamped / MiB) * MiB;
    };

    const resumeKey = getResumeKey(bucket, key, file);
    const existingTask = uploadTasksRef.current.find((t) => t.id === taskId);
    const existing = existingTask?.multipart;
    const persisted = loadResumeRecord(resumeKey);

    let uploadId: string | null = existing?.uploadId ?? persisted?.uploadId ?? null;
    let partSize = existing?.partSize ?? persisted?.partSize ?? pickPartSize(file.size);
    let partsMap: Record<string, string> = existing?.parts ?? persisted?.parts ?? {};

    // If the persisted record doesn't match the file, ignore it.
    if (persisted && (persisted.size !== file.size || persisted.lastModified !== file.lastModified)) {
      uploadId = existing?.uploadId ?? null;
      partsMap = existing?.parts ?? {};
      deleteResumeRecord(resumeKey);
    }

	    if (!uploadId) {
	      let createRes: Response;
	      try {
	        createRes = await fetchWithAuth("/api/multipart", {
	          method: "POST",
	          body: JSON.stringify({ action: "create", bucket, key, contentType: file.type }),
	        });
	      } catch (err: unknown) {
	        const msg = err instanceof Error ? err.message : String(err);
	        throw new Error(`Failed to fetch (POST /api/multipart create): ${msg}`);
	      }
	      const createData = await readJsonSafe(createRes);
	      if (!createRes.ok || !createData.uploadId) throw new Error(createData.error || `create multipart failed (/api/multipart ${createRes.status})`);
	      uploadId = createData.uploadId as string;
	      partsMap = {};
	      partSize = pickPartSize(file.size);
	    }

    updateUploadTask(taskId, (t) => ({
      ...t,
      resumeKey,
      multipart: { uploadId: uploadId as string, partSize, parts: partsMap },
    }));

    upsertResumeRecord(resumeKey, {
      bucket,
      key,
      size: file.size,
      lastModified: file.lastModified,
      name: file.name,
      uploadId: uploadId as string,
      partSize,
      parts: partsMap,
    });

    const partCount = Math.ceil(file.size / partSize);
    const partLoaded = new Map<number, number>();

    const concurrency = Math.min(6, partCount);
    let nextPart = 1;
    let aborted = false;

    const uploadPart = async (partNumber: number) => {
      // Skip uploaded parts (resume).
      if (partsMap[String(partNumber)]) return;
      const start = (partNumber - 1) * partSize;
      const end = Math.min(file.size, start + partSize);
      const blob = file.slice(start, end);

	      let signRes: Response;
	      try {
	        signRes = await fetchWithAuth("/api/multipart", {
	          method: "POST",
	          body: JSON.stringify({ action: "signPart", bucket, key, uploadId, partNumber }),
	        });
	      } catch (err: unknown) {
	        const msg = err instanceof Error ? err.message : String(err);
	        throw new Error(`Failed to fetch (POST /api/multipart signPart): ${msg}`);
	      }
	      const signData = await readJsonSafe(signRes);
	      if (!signRes.ok || !signData.url) throw new Error(signData.error || `sign part failed (/api/multipart ${signRes.status})`);

      const completedBytes = Object.keys(partsMap).reduce((acc, pn) => {
        const n = Number.parseInt(pn, 10);
        if (!Number.isFinite(n) || n <= 0) return acc;
        const s = (n - 1) * partSize;
        const e = Math.min(file.size, s + partSize);
        return acc + Math.max(0, e - s);
      }, 0);

      const { etag } = await xhrPut(signData.url, blob, file.type, (loaded, total) => {
        partLoaded.set(partNumber, loaded);
        const sumLoaded = Array.from(partLoaded.values()).reduce((a, b) => a + b, 0);
        onLoaded(Math.min(file.size, completedBytes + sumLoaded));
        if (loaded === total) partLoaded.set(partNumber, total);
      }, signal);
      if (!etag) throw new Error("Missing ETag");
      partsMap[String(partNumber)] = etag;

      updateUploadTask(taskId, (t) =>
        t.multipart
          ? { ...t, multipart: { ...t.multipart, parts: { ...t.multipart.parts, [String(partNumber)]: etag } } }
          : t,
      );

      upsertResumeRecord(resumeKey, {
        bucket,
        key,
        size: file.size,
        lastModified: file.lastModified,
        name: file.name,
        uploadId: uploadId as string,
        partSize,
        parts: partsMap,
      });
    };

    const worker = async () => {
      for (;;) {
        if (aborted) return;
        const partNumber = nextPart++;
        if (partNumber > partCount) return;
        await uploadPart(partNumber);
      }
    };

    try {
      await Promise.all(Array.from({ length: Math.min(concurrency, partCount) }, worker));
      const parts = Object.entries(partsMap)
        .map(([pn, etag]) => ({ partNumber: Number.parseInt(pn, 10), etag }))
        .filter((p) => Number.isFinite(p.partNumber) && p.partNumber > 0)
        .sort((a, b) => a.partNumber - b.partNumber);
	      let completeRes: Response;
	      try {
	        completeRes = await fetchWithAuth("/api/multipart", {
	          method: "POST",
	          body: JSON.stringify({ action: "complete", bucket, key, uploadId, parts }),
	        });
	      } catch (err: unknown) {
	        const msg = err instanceof Error ? err.message : String(err);
	        throw new Error(`Failed to fetch (POST /api/multipart complete): ${msg}`);
	      }
	      const completeData = await readJsonSafe(completeRes);
	      if (!completeRes.ok) throw new Error(completeData.error || `complete failed (/api/multipart ${completeRes.status})`);
	      deleteResumeRecord(resumeKey);
    } catch (err) {
      aborted = true;
      const current = uploadTasksRef.current.find((t) => t.id === taskId);
      const status = current?.status;
      const abortedByUser = signal?.aborted === true;
      if (abortedByUser && status === "paused") {
        // Keep uploadId/parts for resume.
      } else if (abortedByUser && status === "canceled") {
        await fetchWithAuth("/api/multipart", {
          method: "POST",
          body: JSON.stringify({ action: "abort", bucket, key, uploadId }),
        }).catch(() => {});
        deleteResumeRecord(resumeKey);
      } else {
        // Keep resume record on transient errors; user can retry/resume.
      }
      throw err;
    }
  };

  const updateUploadTask = (id: string, updater: (t: UploadTask) => UploadTask) => {
    setUploadTasks((prev) => prev.map((t) => (t.id === id ? updater(t) : t)));
  };

  const pauseUploadTask = (id: string) => {
    setUploadTasks((prev) =>
      prev.map((t) => (t.id === id && t.status === "uploading" ? { ...t, status: "paused", speedBps: 0 } : t)),
    );
    setUploadQueuePaused(true);
    uploadControllersRef.current.get(id)?.abort();
    setToast("已暂停（可继续续传）");
  };

  const resumeUploadTask = (id: string) => {
    setUploadTasks((prev) =>
      prev.map((t) =>
        t.id === id && (t.status === "paused" || t.status === "error")
          ? { ...t, status: "queued", speedBps: 0, startedAt: undefined, error: undefined }
          : t,
      ),
    );
    setUploadQueuePaused(false);
    setTimeout(() => processUploadQueue(), 0);
  };

  const abortMultipartForTask = async (taskId: string) => {
    const t = uploadTasksRef.current.find((x) => x.id === taskId);
    if (!t?.multipart?.uploadId) return;
    try {
      await fetchWithAuth("/api/multipart", {
        method: "POST",
        body: JSON.stringify({ action: "abort", bucket: t.bucket, key: t.key, uploadId: t.multipart.uploadId }),
      });
    } catch {
      // ignore
    } finally {
      if (t.resumeKey) deleteResumeRecord(t.resumeKey);
    }
  };

  const cancelUploadTask = (id: string) => {
    setUploadTasks((prev) =>
      prev.map((t) => (t.id === id && (t.status === "queued" || t.status === "uploading" || t.status === "paused") ? { ...t, status: "canceled", speedBps: 0 } : t)),
    );
    uploadControllersRef.current.get(id)?.abort();
    void abortMultipartForTask(id);
    setToast("已取消");
  };

  const processUploadQueue = async () => {
    if (uploadProcessingRef.current) return;
    if (uploadQueuePausedRef.current) return;
    uploadProcessingRef.current = true;
    try {
      for (;;) {
        if (uploadQueuePausedRef.current) break;
        const next = uploadTasksRef.current.find((t) => t.status === "queued");
        if (!next) break;

        const controller = new AbortController();
        uploadControllersRef.current.set(next.id, controller);

        updateUploadTask(next.id, (t) => ({
          ...t,
          status: "uploading",
          startedAt: performance.now(),
          loaded: typeof t.loaded === "number" && t.loaded > 0 ? t.loaded : 0,
          speedBps: 0,
          error: undefined,
        }));

        // Prefer multipart for most files to improve throughput on some networks/regions.
        // Keep small files as single PUT to reduce overhead.
        const threshold = 70 * 1024 * 1024;
        const uploadFn = next.file.size >= threshold ? uploadMultipartFile : uploadSingleFile;

        let lastAt = performance.now();
        let lastLoaded = next.loaded ?? 0;

        try {
          await uploadFn(next.id, next.bucket, next.key, next.file, (loaded) => {
            const now = performance.now();
            const deltaBytes = Math.max(0, loaded - lastLoaded);
            const deltaSec = Math.max(0.25, (now - lastAt) / 1000);
            const speedBps = deltaBytes / deltaSec;
            lastAt = now;
            lastLoaded = loaded;

            updateUploadTask(next.id, (t) => ({
              ...t,
              loaded,
              speedBps: Number.isFinite(speedBps) ? speedBps : 0,
            }));
          }, controller.signal);

          updateUploadTask(next.id, (t) => ({ ...t, status: "done", loaded: t.file.size, speedBps: 0, multipart: undefined }));
          if (selectedBucket === next.bucket) fetchFiles(next.bucket, path);
          if (next.resumeKey) deleteResumeRecord(next.resumeKey);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          const current = uploadTasksRef.current.find((t) => t.id === next.id);
          if (current?.status === "paused" || current?.status === "canceled") {
            // keep status
          } else {
            updateUploadTask(next.id, (t) => ({ ...t, status: "error", error: message, speedBps: 0 }));
          }
        } finally {
          uploadControllersRef.current.delete(next.id);
        }
      }
    } finally {
      uploadProcessingRef.current = false;
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !selectedBucket) return;
    const filesToUpload = Array.from(e.target.files);
    const prefix = path.length > 0 ? path.join("/") + "/" : "";

    const newTasks: UploadTask[] = filesToUpload.map((file) => ({
      id: (globalThis.crypto?.randomUUID?.() as string | undefined) ?? `${Date.now()}_${Math.random().toString(16).slice(2)}`,
      bucket: selectedBucket,
      file,
      key: prefix + file.name,
      resumeKey: getResumeKey(selectedBucket, prefix + file.name, file),
      loaded: 0,
      speedBps: 0,
      status: "queued",
    }));

    setUploadTasks((prev) => [...newTasks, ...prev].slice(0, 50));
    setUploadPanelOpen(true);
    setToast(`已加入 ${newTasks.length} 个上传任务`);

    if (fileInputRef.current) fileInputRef.current.value = "";
    setTimeout(() => processUploadQueue(), 0);
  };

  // --- 视图数据处理 ---
  const filteredFiles = useMemo(() => {
    const term = searchTerm.trim();
    if (!term) return files;
    return searchResults;
  }, [files, searchResults, searchTerm]);

  const uploadSummary = useMemo(() => {
    const totalBytes = uploadTasks.reduce((acc, t) => acc + t.file.size, 0);
    const loadedBytes = uploadTasks.reduce((acc, t) => acc + Math.min(t.loaded, t.file.size), 0);
    const active = uploadTasks.filter((t) => t.status === "queued" || t.status === "uploading").length;
    const speedBps = uploadTasks.reduce((acc, t) => acc + (t.status === "uploading" ? t.speedBps : 0), 0);
    const pct = totalBytes ? Math.min(100, Math.round((loadedBytes / totalBytes) * 100)) : 0;
    return {
      active,
      total: uploadTasks.length,
      pct,
      speedText: formatSpeed(speedBps),
    };
  }, [uploadTasks]);

  const currentViewStats = useMemo(() => {
    const fileCount = files.filter(f => f.type === "file").length;
    const folderCount = files.filter(f => f.type === "folder").length;
    const totalSize = files.reduce((acc, curr) => acc + (curr.size || 0), 0);
    return { fileCount, folderCount, totalSize };
  }, [files]);

  const getIcon = (type: string, name: string, size: "lg" | "sm" = "lg") => {
    const cls = size === "lg" ? "w-8 h-8" : "w-5 h-5";
    if (type === "folder") return <Folder className={`${cls} text-yellow-500 ${size === "lg" ? "fill-yellow-500/20" : ""}`} />;
    const lower = name.toLowerCase();
    const ext = getFileExt(name);
    if (/\.(jpg|png|gif|webp|svg)$/.test(lower)) return <ImageIcon className={`${cls} text-purple-500`} />;
    if (/\.(mp4|mov|mkv|webm)$/.test(lower)) return <Video className={`${cls} text-red-500`} />;
    if (/\.(mp3|wav|flac|ogg)$/.test(lower)) return <Music className={`${cls} text-blue-500`} />;
    if (/(zip|rar|7z|tar|gz|bz2|xz)$/.test(ext)) return <FileArchive className={`${cls} text-amber-600`} />;
    if (/(xls|xlsx|csv)$/.test(ext)) return <FileSpreadsheet className={`${cls} text-emerald-600`} />;
    if (ext === "json") return <FileJson className={`${cls} text-orange-600`} />;
    if (ext === "pdf") return <FileType className={`${cls} text-rose-600`} />;
    if (/(doc|docx|ppt|pptx)$/.test(ext)) return <FileType className={`${cls} text-sky-600`} />;
    if (/(apk|ipa|dmg|pkg|exe|msi|deb|rpm)$/.test(ext)) return <FileType className={`${cls} text-slate-600`} />;
    if (/(ts|tsx|js|jsx|css|html|xml|yml|yaml|md|txt|log|sh|bash|py|go|rs|java|kt|c|cpp|h|hpp)$/.test(ext))
      return <FileCode className={`${cls} text-indigo-600`} />;
    return <FileText className={`${cls} text-gray-400`} />;
  };

  // --- 渲染：登录界面 ---
  if (authRequired) {
    const showAnnouncementPanel = !isMobile || loginAnnouncementOpen;
    return (
      <div className="min-h-dvh bg-gradient-to-br from-slate-50 via-white to-slate-50 dark:from-gray-950 dark:via-gray-950 dark:to-gray-900 flex items-center justify-center px-4 py-6 sm:p-6 font-sans text-gray-900 dark:text-gray-100 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
          {/* 左侧：公告与说明 */}
          <section
            className={`rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden flex flex-col order-2 lg:order-1 dark:border-gray-800 dark:bg-gray-900 ${
              showAnnouncementPanel ? "" : "hidden"
            }`}
          >
            <div className="px-8 py-7 h-[168px] bg-gradient-to-br from-indigo-600 to-blue-600 text-white flex items-center">
              <div className="w-full">
                <div className="text-sm font-medium text-white/85">{LOGIN_PAGE.title}</div>
                <h1 className="mt-2 text-3xl font-semibold tracking-tight">公告与说明</h1>
                <p className="mt-2 text-white/80">{LOGIN_PAGE.subtitle}</p>
              </div>
            </div>

            <div className="px-8 py-7 flex flex-col gap-6 grow">
              <div>
                <div className="text-xs font-semibold tracking-wide text-gray-500 dark:text-gray-400">平台优势</div>
                <ul className="mt-3 space-y-2 text-sm text-gray-800 dark:text-gray-200">
                  {LOGIN_PAGE.advantages.map((t) => (
                    <li key={t} className="flex gap-3">
                      <span className="mt-2 h-1.5 w-1.5 rounded-full bg-blue-600 flex-none" />
                      <span className="leading-relaxed">{t}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <div className="text-xs font-semibold tracking-wide text-gray-500 dark:text-gray-400">{LOGIN_PAGE.announcementTitle}</div>
                <div className="mt-3 rounded-2xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700 whitespace-pre-wrap leading-relaxed dark:border-gray-800 dark:bg-gray-950/30 dark:text-gray-200">
                  {LOGIN_PAGE.announcementText}
                </div>
              </div>

              <div className="mt-auto">
                <div className="text-xs font-semibold tracking-wide text-gray-500 dark:text-gray-400">导航</div>
                <nav className="mt-3 grid grid-cols-4 gap-2">
                  {LOGIN_LINKS.map((l) => {
                    const icon =
                      l.icon === "globe" ? (
                        <Globe className="w-5 h-5" />
                      ) : l.icon === "book" ? (
                        <BookOpen className="w-5 h-5" />
                      ) : l.icon === "about" ? (
                        <BadgeInfo className="w-5 h-5" />
                      ) : (
                        <Mail className="w-5 h-5" />
                      );

                    return (
                      <a
                        key={l.href}
                        href={l.href}
                        target={l.href.startsWith("mailto:") ? undefined : "_blank"}
                        rel={l.href.startsWith("mailto:") ? undefined : "noreferrer"}
                        className="group rounded-xl border border-gray-200 bg-white hover:bg-gray-50 transition-colors px-2 py-3 flex flex-col items-center justify-center gap-2 dark:border-gray-800 dark:bg-gray-950 dark:hover:bg-gray-900"
                      >
                        <div className="text-gray-700 group-hover:text-blue-600 transition-colors dark:text-gray-200 dark:group-hover:text-blue-300">
                          {icon}
                        </div>
                        <div className="text-[12px] text-gray-700 group-hover:text-blue-600 transition-colors dark:text-gray-200 dark:group-hover:text-blue-300">
                          {l.label}
                        </div>
                      </a>
                    );
                  })}
                </nav>

                <div className="mt-6 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                  <span>{LOGIN_PAGE.footer}</span>
                  <span className="inline-flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    Serverless
                  </span>
                </div>
              </div>
            </div>
          </section>

          {/* 右侧：登录模块 */}
	          <section className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden flex flex-col order-1 lg:order-2 dark:border-gray-800 dark:bg-gray-900">
		            <div className="px-6 py-4 sm:px-8 sm:py-7 sm:h-[168px] bg-blue-600 text-white flex items-center shrink-0">
		              <div className="flex items-center gap-4 w-full">
		                <div className="h-16 w-16 flex items-center justify-center shrink-0">
		                  <BrandMark className="w-16 h-16" />
		                </div>
		                <div>
		                  <div className="text-2xl font-semibold leading-tight">{LOGIN_PAGE.title}</div>
			                  <div className="mt-1 text-[17px] text-white/80">{LOGIN_PAGE.subtitle}</div>
		                </div>
		              </div>
		            </div>

	            <div className="px-8 py-10 flex flex-col gap-8 grow">
		              <div className="text-center">
		                <h2 className="text-3xl font-bold tracking-tight text-blue-600 dark:text-blue-400">管理员登录</h2>
		              </div>

		              <form onSubmit={handleLogin} className="space-y-7">
	                <div>
	                  <label className="block text-sm font-medium text-gray-700 mb-2 dark:text-gray-200">管理账号</label>
	                  <input
	                    type="text"
	                    value={formUsername}
	                    onChange={(e) => setFormUsername(e.target.value)}
	                    className="w-full px-4 py-3 rounded-lg border border-gray-300 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all dark:border-gray-800 dark:bg-gray-950 dark:text-gray-100 dark:placeholder:text-gray-500"
	                    placeholder="请输入账号"
	                  />
	                </div>

	                <div>
	                  <label className="block text-sm font-medium text-gray-700 mb-2 dark:text-gray-200">管理密码</label>
	                  <div className="relative">
	                    <input
	                      type={showSecret ? "text" : "password"}
	                      value={formPassword}
	                      onChange={(e) => setFormPassword(e.target.value)}
	                      className="w-full px-4 py-3 rounded-lg border border-gray-300 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all pr-10 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-100 dark:placeholder:text-gray-500"
	                      placeholder="请输入密码"
	                    />
	                    <button
	                      type="button"
	                      onClick={() => setShowSecret(!showSecret)}
	                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
	                    >
	                      {showSecret ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
	                    </button>
	                  </div>
	                </div>

	                <div className="flex items-center">
	                  <input
	                    type="checkbox"
	                    id="remember"
	                    checked={rememberMe}
	                    onChange={(e) => setRememberMe(e.target.checked)}
	                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 dark:border-gray-700"
	                  />
	                  <label htmlFor="remember" className="ml-2 block text-sm text-gray-600 dark:text-gray-300">
	                    记住登陆状态
	                  </label>
	                </div>

		                <button
		                  type="submit"
		                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition-colors shadow-blue-500/20 shadow-lg flex items-center justify-center gap-2"
		                >
		                  <ShieldCheck className="w-5 h-5" />
		                  进入管理
		                </button>

                    {isMobile ? (
                      <button
                        type="button"
                        onClick={() => setLoginAnnouncementOpen((v) => !v)}
                        className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors dark:border-gray-800 dark:bg-gray-950 dark:text-gray-200 dark:hover:bg-gray-900"
                      >
                        {loginAnnouncementOpen ? "收起「公告与说明」" : "展开「公告与说明」"}
                        <ChevronDown
                          className={`w-4 h-4 text-gray-400 transition-transform ${loginAnnouncementOpen ? "rotate-180" : ""}`}
                        />
                      </button>
                    ) : null}
		              </form>
		            </div>
	          </section>
        </div>

        {ToastView}
      </div>
    );
  }

		  // --- 渲染：主界面 ---
		  const getBucketLabel = (bucketId: string | null | undefined) => (bucketId ? bucketId : "");

		  const selectedBucketDisplayName = selectedBucket ? getBucketLabel(selectedBucket) : null;

	  const selectBucket = (bucketId: string) => {
	    setSelectedBucket(bucketId);
	    setPath([]);
	    setSearchTerm("");
    setSelectedItem(null);
	    setSelectedKeys(new Set());
	    setBucketMenuOpen(false);
	    if (isMobile) setMobileNavOpen(false);
	    setToast(`已切换到：${getBucketLabel(bucketId)}`);
	  };

	  const SidebarPanel = ({ onClose }: { onClose?: () => void }) => (
	    <div
	      className={`h-full w-full bg-white border-r border-gray-200 flex flex-col dark:bg-gray-900 dark:border-gray-800 ${
	        onClose ? "shadow-sm" : ""
	      }`}
	    >
	      <div className="h-16 px-5 border-b border-gray-100 flex items-center justify-between gap-3 dark:border-gray-800">
	        <div className="flex items-center gap-3 min-w-0">
		          <BrandMark className="w-10 h-10 md:w-11 md:h-11 shrink-0" />
		          <div className="min-w-0">
			            <h1 className="font-bold text-[18px] leading-[1.15] tracking-tight text-blue-600 truncate dark:text-blue-400">Qing&apos;s R2 Admin</h1>
	            <p className="mt-0.25 text-[13px] leading-[1.1] text-gray-400 font-medium truncate dark:text-gray-400">{LOGIN_PAGE.subtitle}</p>
		          </div>
	        </div>
	        <div className="flex items-center gap-1">
	          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
              aria-label="关闭菜单"
            >
              <X className="w-5 h-5" />
            </button>
          ) : null}
        </div>
      </div>

      <div className="flex-1 flex flex-col overflow-y-auto">
        <div className="p-3 space-y-3 shrink-0">
          <div className="px-1">
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs font-semibold text-gray-500 uppercase px-2 tracking-wider leading-none dark:text-gray-400">存储桶</div>
              <button
                type="button"
                onClick={() => {
                  void fetchBuckets();
                  setToast("已刷新桶列表");
                }}
                className="px-2 py-1 rounded-md text-xs font-medium text-blue-600 hover:bg-blue-50 leading-none dark:text-blue-300 dark:hover:bg-blue-950/30"
                title="刷新桶列表"
                aria-label="刷新桶列表"
              >
                刷新
              </button>
            </div>

            {isMobile ? (
              <div className="mt-2">
                <select
                  value={selectedBucket ?? ""}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (!v) return;
                    selectBucket(v);
                  }}
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors dark:border-gray-800 dark:bg-gray-950 dark:text-gray-100"
                  aria-label="选择存储桶"
                >
                  <option value="" disabled>
                    选择存储桶
                  </option>
	                  {buckets.map((b) => (
	                    <option key={b.id} value={b.id}>
	                      {getBucketLabel(b.id)}
	                    </option>
	                  ))}
	                </select>
	              </div>
            ) : (
              <div ref={bucketMenuRef} className="relative mt-2">
                <button
                  type="button"
                  onClick={() => setBucketMenuOpen((v) => !v)}
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors dark:border-gray-800 dark:bg-gray-950 dark:text-gray-100 flex items-center justify-between gap-3"
                  aria-haspopup="listbox"
                  aria-expanded={bucketMenuOpen}
                >
	                  <span className="truncate">
	                    {selectedBucket ? getBucketLabel(selectedBucket) : "选择存储桶"}
	                  </span>
                  <ChevronDown
                    className={`w-4 h-4 text-gray-400 dark:text-gray-500 transition-transform ${
                      bucketMenuOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>

                {bucketMenuOpen ? (
                  <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-20 rounded-2xl border border-gray-200 bg-white shadow-xl overflow-hidden dark:border-gray-800 dark:bg-gray-900">
                    <div className="max-h-[40vh] overflow-auto p-2">
                      {buckets.length ? (
                        buckets.map((bucket) => (
                          <button
                            key={bucket.id}
                            type="button"
                            onClick={() => selectBucket(bucket.id)}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors ${
                              selectedBucket === bucket.id
                                ? "bg-blue-50 text-blue-700 font-medium dark:bg-blue-950/40 dark:text-blue-200"
                                : "text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800"
                            }`}
                          >
                            <div
                              className={`w-2 h-2 rounded-full ${
                                selectedBucket === bucket.id ? "bg-blue-500" : "bg-gray-300 dark:bg-gray-700"
                              }`}
                            ></div>
	                            <span className="truncate">{getBucketLabel(bucket.id)}</span>
	                          </button>
	                        ))
                      ) : (
                        <div className="px-3 py-3 text-sm text-gray-500 dark:text-gray-400">暂无桶</div>
                      )}
                    </div>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </div>

        <div className="flex-1" />

        <div className="p-4 border-t border-gray-100 bg-gray-50/50 space-y-3 dark:border-gray-800 dark:bg-gray-950/30 shrink-0">
        <div
          className={`text-xs px-3 py-2 rounded-md border ${
            connectionStatus === "connected"
              ? "bg-green-50 text-green-700 border-green-100 dark:bg-green-950/40 dark:text-green-200 dark:border-green-900"
              : connectionStatus === "checking"
                ? "bg-yellow-50 text-yellow-700 border-yellow-100 dark:bg-yellow-950/35 dark:text-yellow-200 dark:border-yellow-900"
                : connectionStatus === "unbound"
                  ? "bg-blue-50 text-blue-700 border-blue-100 dark:bg-blue-950/40 dark:text-blue-200 dark:border-blue-900"
                  : "bg-red-50 text-red-700 border-red-100 dark:bg-red-950/40 dark:text-red-200 dark:border-red-900"
          }`}
        >
          <div className="flex items-center gap-2">
            <Wifi className="w-3 h-3" />
            <span className="font-medium">
              {connectionStatus === "connected"
                ? "连接状态正常"
                : connectionStatus === "checking"
                  ? "连接中..."
                  : connectionStatus === "unbound"
                    ? "未绑定存储桶"
                    : "连接异常"}
            </span>
          </div>
          {connectionStatus === "connected" ? (
            <div className="mt-1 text-[10px] leading-relaxed opacity-80">
              {(() => {
                const mode = selectedBucket ? buckets.find((b) => b.id === selectedBucket)?.transferMode : undefined;
                const cfg = selectedBucket ? getLinkConfig(selectedBucket) : undefined;
                if (mode === "presigned") return "当前传输通道：R2 直连（S3 预签名）";
	                if (mode === "presigned_needs_bucket_name") {
	                  if (cfg?.s3BucketName) return "当前传输通道：R2 直连（S3 预签名）";
	                  return "当前传输通道：Pages 代理。已启用直连能力，配置「链接设置」补全桶名后才会生效";
	                }
                if (mode === "proxy") return "当前传输通道：Pages 代理（R2 Binding）";
                return "当前传输通道：未检测";
              })()}
            </div>
          ) : null}

          {connectionDetail ? (
            <div className="mt-1 text-[10px] leading-relaxed opacity-80">{connectionDetail}</div>
          ) : null}
        </div>

        <div className="px-3 py-2 rounded-md border border-gray-200 bg-white text-xs text-gray-600 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-200">
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium truncate">当前桶占用估算</span>
            <button
              onClick={() => selectedBucket && fetchBucketUsage(selectedBucket)}
              disabled={!selectedBucket || usageLoading}
              className="text-[11px] text-blue-600 hover:text-blue-700 disabled:opacity-50 dark:text-blue-300 dark:hover:text-blue-200"
            >
              {usageLoading ? "计算中..." : "刷新"}
            </button>
          </div>
          <div className="mt-1.5 flex items-center justify-between">
            <span className="text-[11px] text-gray-500 dark:text-gray-400">对象数</span>
            <span className="text-[11px] font-semibold text-gray-800 dark:text-gray-100">
              {bucketUsage ? (bucketUsage.truncated ? `≥${bucketUsage.objects}` : `${bucketUsage.objects}`) : "-"}
            </span>
          </div>
          <div className="mt-1 flex items-center justify-between">
            <span className="text-[11px] text-gray-500 dark:text-gray-400">容量</span>
            <span className="text-[11px] font-semibold text-gray-800 dark:text-gray-100">
              {bucketUsage ? (bucketUsage.truncated ? `≥${formatSize(bucketUsage.bytes)}` : formatSize(bucketUsage.bytes)) : "-"}
            </span>
          </div>
          {bucketUsage?.truncated ? (
            <div className="mt-1 text-[10px] text-gray-400 dark:text-gray-500">仅扫描前 {bucketUsage.pagesScanned} 页（每页最多 1000 项）</div>
          ) : null}
        </div>

        <div className="px-3 py-2 rounded-md border border-gray-200 bg-white text-xs text-gray-600 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-200">
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium truncate">账号总占用估算</span>
            <button
              onClick={() => fetchAccountUsageTotal(buckets)}
              disabled={!buckets.length || accountUsageLoading}
              className="text-[11px] text-blue-600 hover:text-blue-700 disabled:opacity-50 dark:text-blue-300 dark:hover:text-blue-200"
            >
              {accountUsageLoading ? "计算中..." : "刷新"}
            </button>
          </div>
          <div className="mt-1.5 flex items-center justify-between">
            <span className="text-[11px] text-gray-500 dark:text-gray-400">桶数量</span>
            <span className="text-[11px] font-semibold text-gray-800 dark:text-gray-100">{accountUsage ? accountUsage.buckets : "-"}</span>
          </div>
          <div className="mt-1 flex items-center justify-between">
            <span className="text-[11px] text-gray-500 dark:text-gray-400">对象数</span>
            <span className="text-[11px] font-semibold text-gray-800 dark:text-gray-100">{accountUsage ? `${accountUsage.objects}` : "-"}</span>
          </div>
          <div className="mt-1 flex items-center justify-between">
            <span className="text-[11px] text-gray-500 dark:text-gray-400">容量</span>
            <span className="text-[11px] font-semibold text-gray-800 dark:text-gray-100">
              {accountUsage ? formatSize(accountUsage.bytes) : "-"}
            </span>
          </div>
          {accountUsage?.truncatedBuckets ? (
            <div className="mt-1 text-[10px] text-gray-400 dark:text-gray-500">有 {accountUsage.truncatedBuckets} 个桶为截断估算</div>
          ) : null}
        </div>

        <button
          onClick={handleConfigureLinks}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 hover:text-blue-600 hover:border-blue-200 rounded-lg text-xs font-medium transition-colors dark:bg-gray-900 dark:border-gray-800 dark:text-gray-200 dark:hover:bg-gray-800 dark:hover:text-blue-200"
        >
          <Settings className="w-3 h-3" />
          链接设置
        </button>

        <button
          onClick={() => setLogoutOpen(true)}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-white border border-gray-200 text-gray-600 hover:bg-red-50 hover:text-red-600 hover:border-red-200 rounded-lg text-xs font-medium transition-colors dark:bg-gray-900 dark:border-gray-800 dark:text-gray-200 dark:hover:bg-red-950/40 dark:hover:text-red-200 dark:hover:border-red-900"
        >
          <LogOut className="w-3 h-3" />
          退出登录
        </button>
      </div>
      </div>
    </div>
  );

  const DetailsPanel = ({ onClose, compact }: { onClose?: () => void; compact?: boolean }) => (
    <div className="h-full w-full bg-white border-l border-gray-200 flex flex-col shadow-sm dark:bg-gray-900 dark:border-gray-800">
      <div className="h-16 px-5 border-b border-gray-100 flex items-center justify-between gap-3 dark:border-gray-800">
        <h2 className="font-bold text-gray-800 text-sm uppercase tracking-wide dark:text-gray-100">详细信息</h2>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
            aria-label="关闭详情"
          >
            <X className="w-5 h-5" />
          </button>
        ) : null}
      </div>

      <div className={`flex-1 overflow-y-auto ${compact ? "p-4 space-y-5" : "p-6 space-y-8"}`}>
        {selectedItem ? (
	          <div className={`${compact ? "space-y-4" : "space-y-6"} animate-in fade-in slide-in-from-right-4 duration-300`}>
	            <div className={compact ? "flex items-center gap-3" : "flex flex-col items-center"}>
	              <div
	                className={`${
	                  compact ? "w-14 h-14 rounded-xl" : "w-16 h-16 rounded-2xl"
	                } bg-gray-50 border border-gray-100 flex items-center justify-center ${
	                  compact ? "" : "mb-4"
	                } shadow-sm dark:bg-gray-950 dark:border-gray-800`}
	              >
	                {getIcon(selectedItem.type, selectedItem.name)}
              </div>
              <div className={compact ? "min-w-0 flex-1" : ""}>
                <h3
                  className={`font-semibold text-gray-900 ${
                    compact ? "text-left break-words" : "text-center break-all px-2"
                  } leading-snug dark:text-gray-100`}
                >
                  {selectedItem.name}
                </h3>
                {compact ? (
                  <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    {selectedItem.type === "folder" ? "文件夹" : formatSize(selectedItem.size)}
                    {selectedItem.lastModified ? ` · ${new Date(selectedItem.lastModified).toLocaleDateString()}` : ""}
	                  </div>
	                ) : (
	                  <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
	                    <span className="text-[10px] px-2 py-0.5 rounded-full border border-gray-200 bg-white text-gray-600 font-semibold dark:border-gray-800 dark:bg-gray-900 dark:text-gray-200">
	                      {getFileTag(selectedItem)}
	                    </span>
	                    <span className="text-xs text-gray-500 dark:text-gray-400">
	                      {selectedItem.type === "folder" ? "文件夹" : "文件"}
	                      {selectedItem.type === "file" ? ` · ${formatSize(selectedItem.size)}` : ""}
	                      {selectedItem.lastModified ? ` · ${new Date(selectedItem.lastModified).toLocaleDateString()}` : ""}
	                    </span>
	                  </div>
	                )}
	              </div>
	            </div>
	
	            {selectedItem.type === "folder" ? (
	              <div className={`grid grid-cols-2 ${compact ? "gap-2 pt-1" : "gap-3 pt-2"}`}>
	                <button
	                  onClick={() => handleEnterFolder(selectedItem!.name)}
                  className="flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg text-sm font-medium transition-colors col-span-2"
                >
                  <FolderOpen className="w-4 h-4" />
                  打开文件夹
                </button>
                <button
                  onClick={handleRename}
                  className="flex items-center justify-center gap-2 px-3 py-2 bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 hover:text-blue-600 rounded-lg text-sm font-medium transition-colors dark:bg-gray-900 dark:border-gray-800 dark:text-gray-100 dark:hover:bg-gray-800 dark:hover:text-blue-200"
                >
                  <Edit2 className="w-4 h-4" />
                  重命名
                </button>
                <button
                  onClick={() => handleMoveOrCopy("move")}
                  className="flex items-center justify-center gap-2 px-3 py-2 bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 hover:text-blue-600 rounded-lg text-sm font-medium transition-colors dark:bg-gray-900 dark:border-gray-800 dark:text-gray-100 dark:hover:bg-gray-800 dark:hover:text-blue-200"
                >
                  <ArrowRightLeft className="w-4 h-4" />
                  移动
                </button>
                <button
                  onClick={() => handleMoveOrCopy("copy")}
                  className="flex items-center justify-center gap-2 px-3 py-2 bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 hover:text-blue-600 rounded-lg text-sm font-medium transition-colors dark:bg-gray-900 dark:border-gray-800 dark:text-gray-100 dark:hover:bg-gray-800 dark:hover:text-blue-200"
                >
                  <Copy className="w-4 h-4" />
                  复制
                </button>
                <button
                  onClick={handleDelete}
                  className="flex items-center justify-center gap-2 px-3 py-2 bg-white border border-gray-200 text-red-600 hover:bg-red-50 hover:border-red-200 rounded-lg text-sm font-medium transition-colors dark:bg-gray-900 dark:border-gray-800 dark:text-red-200 dark:hover:bg-red-950/40 dark:hover:border-red-900"
                >
                  <Trash2 className="w-4 h-4" />
                  删除
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  onClick={() => previewItem(selectedItem!)}
                  className="flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg text-sm font-medium transition-colors col-span-2"
                >
                  <Eye className="w-4 h-4" />
                  预览
                </button>
                <button
                  onClick={() => downloadItem(selectedItem!)}
                  className="flex items-center justify-center gap-2 px-3 py-2 bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 hover:text-blue-600 rounded-lg text-sm font-medium transition-colors dark:bg-gray-900 dark:border-gray-800 dark:text-gray-100 dark:hover:bg-gray-800 dark:hover:text-blue-200"
                >
                  <Download className="w-4 h-4" />
                  下载
                </button>
                <button
                  onClick={handleRename}
                  className="flex items-center justify-center gap-2 px-3 py-2 bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 hover:text-blue-600 rounded-lg text-sm font-medium transition-colors dark:bg-gray-900 dark:border-gray-800 dark:text-gray-100 dark:hover:bg-gray-800 dark:hover:text-blue-200"
                >
                  <Edit2 className="w-4 h-4" />
                  重命名
                </button>
                <button
                  onClick={() => handleMoveOrCopy("move")}
                  className="flex items-center justify-center gap-2 px-3 py-2 bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 hover:text-blue-600 rounded-lg text-sm font-medium transition-colors dark:bg-gray-900 dark:border-gray-800 dark:text-gray-100 dark:hover:bg-gray-800 dark:hover:text-blue-200"
                >
                  <ArrowRightLeft className="w-4 h-4" />
                  移动
                </button>
                <button
                  onClick={() => handleMoveOrCopy("copy")}
                  className="flex items-center justify-center gap-2 px-3 py-2 bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 hover:text-blue-600 rounded-lg text-sm font-medium transition-colors dark:bg-gray-900 dark:border-gray-800 dark:text-gray-100 dark:hover:bg-gray-800 dark:hover:text-blue-200"
                >
                  <Copy className="w-4 h-4" />
                  复制
                </button>
                <button
                  onClick={handleDelete}
                  className="flex items-center justify-center gap-2 px-3 py-2 bg-white border border-gray-200 text-red-600 hover:bg-red-50 hover:border-red-200 rounded-lg text-sm font-medium transition-colors dark:bg-gray-900 dark:border-gray-800 dark:text-red-200 dark:hover:bg-red-950/40 dark:hover:border-red-900"
                >
                  <Trash2 className="w-4 h-4" />
                  删除
                </button>
                <button
                  onClick={() => copyLinkForItem(selectedItem!, "public")}
                  className="flex items-center justify-center gap-2 px-3 py-2 bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 hover:text-blue-600 rounded-lg text-sm font-medium transition-colors dark:bg-gray-900 dark:border-gray-800 dark:text-gray-100 dark:hover:bg-gray-800 dark:hover:text-blue-200"
                >
                  <Link2 className="w-4 h-4" />
                  公共链接
                </button>
                <button
                  onClick={() => copyLinkForItem(selectedItem!, "custom")}
                  className="flex items-center justify-center gap-2 px-3 py-2 bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 hover:text-blue-600 rounded-lg text-sm font-medium transition-colors dark:bg-gray-900 dark:border-gray-800 dark:text-gray-100 dark:hover:bg-gray-800 dark:hover:text-blue-200"
                >
                  <Link2 className="w-4 h-4" />
                  自定义链接
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4 dark:bg-gray-950">
              <Search className="w-6 h-6 text-gray-300 dark:text-gray-600" />
            </div>
            <p className="text-gray-500 text-sm dark:text-gray-400">
              选择一个文件以查看详情
              <br />
              或进行管理
            </p>
          </div>
        )}

        {!compact ? (
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-5 border border-blue-100 dark:from-blue-950/35 dark:to-indigo-950/25 dark:border-blue-900">
            <h3 className="text-[10px] font-bold text-blue-800 uppercase tracking-wider mb-4 flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
              当前视图统计
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-500 dark:text-gray-400">文件数</span>
                <span className="text-sm font-bold text-gray-800 dark:text-gray-100">{currentViewStats.fileCount}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-500 dark:text-gray-400">文件夹数</span>
                <span className="text-sm font-bold text-gray-800 dark:text-gray-100">{currentViewStats.folderCount}</span>
              </div>
              <div className="h-px bg-blue-200/50 my-2 dark:bg-blue-900/50"></div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-500 dark:text-gray-400">总大小</span>
                <span className="text-sm font-bold text-blue-700 dark:text-blue-200">{formatSize(currentViewStats.totalSize)}</span>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <div className="p-4 border-t border-gray-100 bg-gray-50 text-[10px] text-gray-400 text-center dark:border-gray-800 dark:bg-gray-950/30 dark:text-gray-400">
        <p>Qing&apos;s R2 Admin</p>
        <p className="mt-0.5">R2对象存储多功能管理工具</p>
      </div>
    </div>
  );

  return (
    <div className="flex h-dvh md:h-screen bg-gray-50 text-gray-900 font-sans overflow-hidden dark:bg-gray-900 dark:text-gray-100">
      {/* 移动端：左侧抽屉 */}
      <div className={`fixed inset-0 z-50 md:hidden ${mobileNavOpen ? "" : "pointer-events-none"}`}>
        <button
          type="button"
          aria-label="关闭菜单"
          onClick={() => setMobileNavOpen(false)}
          className={`absolute inset-0 bg-black/40 transition-opacity ${mobileNavOpen ? "opacity-100" : "opacity-0"}`}
        />
        <div
          className={`absolute inset-y-0 left-0 w-[18rem] max-w-[85vw] transition-transform duration-200 ${
            mobileNavOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <SidebarPanel onClose={() => setMobileNavOpen(false)} />
        </div>
      </div>

      {/* 桌面端：左侧栏 */}
      <div className="hidden md:block w-[17rem] shrink-0">
        <SidebarPanel />
      </div>

      {/* 中间：文件浏览器 */}
      <main className="flex-1 flex flex-col min-w-0 bg-white dark:bg-gray-900">
        {/* 顶部工具栏 */}
          <div className="border-b border-gray-200 bg-white shrink-0 dark:border-gray-800 dark:bg-gray-900">
          {/* 桌面端：保持原布局 */}
          <div className="hidden md:flex h-16 border-b-0 items-center px-6 gap-6">
            <div className="flex items-center gap-2">
              <button
                onClick={() => selectedBucket && fetchFiles(selectedBucket, path)}
                disabled={!selectedBucket}
                className="w-12 h-14 flex flex-col items-center justify-center gap-1 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 dark:text-gray-300 dark:hover:bg-gray-800"
                title="刷新"
                aria-label="刷新"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                <span className="text-[10px] leading-none text-gray-500 dark:text-gray-400">刷新</span>
              </button>
              <button
                onClick={handleBatchDownload}
                disabled={selectedKeys.size === 0}
                className="w-12 h-14 flex flex-col items-center justify-center gap-1 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 dark:text-gray-300 dark:hover:bg-gray-800"
                title="批量下载（所选文件）"
                aria-label="下载"
              >
                <Download className="w-4 h-4" />
                <span className="text-[10px] leading-none text-gray-500 dark:text-gray-400">下载</span>
              </button>
              <button
                onClick={openBatchMove}
                disabled={selectedKeys.size === 0}
                className="w-12 h-14 flex flex-col items-center justify-center gap-1 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 dark:text-gray-300 dark:hover:bg-gray-800"
                title="批量移动（所选文件）"
                aria-label="移动"
              >
                <ArrowRightLeft className="w-4 h-4" />
                <span className="text-[10px] leading-none text-gray-500 dark:text-gray-400">移动</span>
              </button>
              <button
                onClick={handleRenameFromToolbar}
                disabled={selectedKeys.size > 1 || (selectedKeys.size === 0 && !selectedItem)}
                className="w-12 h-14 flex flex-col items-center justify-center gap-1 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 dark:text-gray-300 dark:hover:bg-gray-800"
                title="重命名（仅支持单选）"
                aria-label="重命名"
              >
                <Edit2 className="w-4 h-4" />
                <span className="text-[10px] leading-none text-gray-500 dark:text-gray-400">重命名</span>
              </button>
              <button
                onClick={handleDelete}
                disabled={selectedKeys.size === 0 && !selectedItem}
                className="w-12 h-14 flex flex-col items-center justify-center gap-1 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 dark:text-red-200 dark:hover:bg-red-950/40"
                title="删除（所选项）"
                aria-label="删除"
              >
                <Trash2 className="w-4 h-4" />
                <span className="text-[10px] leading-none">删除</span>
              </button>
              <button
                onClick={openMkdir}
                disabled={!selectedBucket || !!searchTerm.trim()}
                className="w-12 h-14 flex flex-col items-center justify-center gap-1 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 dark:text-gray-300 dark:hover:bg-gray-800"
                title={searchTerm.trim() ? "搜索中无法新建文件夹" : "新建文件夹"}
                aria-label="新建"
              >
                <FolderPlus className="w-4 h-4" />
                <span className="text-[10px] leading-none text-gray-500 dark:text-gray-400">新建</span>
              </button>
              <button
                type="button"
                onClick={() =>
                  setThemeMode((prev) =>
                    prev === "system" ? (resolvedDark ? "light" : "dark") : prev === "dark" ? "light" : "system",
                  )
                }
                className="w-12 h-14 flex flex-col items-center justify-center gap-1 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors active:scale-95 dark:text-gray-300 dark:hover:bg-gray-800"
                title={themeMode === "system" ? "主题：跟随系统" : themeMode === "dark" ? "主题：深色" : "主题：浅色"}
                aria-label="主题"
              >
                {themeMode === "dark" ? (
                  <Moon className="w-4 h-4" />
                ) : themeMode === "light" ? (
                  <Sun className="w-4 h-4" />
                ) : (
                  <Monitor className="w-4 h-4" />
                )}
                <span className="text-[10px] leading-none text-gray-500 dark:text-gray-400">主题</span>
              </button>
            </div>

            <div className="flex-1" />

            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
                <input
                  type="text"
                  placeholder="桶内全局搜索..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 pr-9 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 w-60 transition-all dark:bg-gray-950 dark:border-gray-800 dark:text-gray-100 dark:placeholder:text-gray-500"
                />
                {searchLoading ? (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <RefreshCw className="w-4 h-4 text-gray-400 animate-spin dark:text-gray-500" />
                  </div>
                ) : null}
              </div>
              <button
                onClick={() => {
                  if (!selectedBucket) return;
                  if (uploadTasks.length > 0) setUploadPanelOpen(true);
                  else fileInputRef.current?.click();
                }}
                disabled={!selectedBucket}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-all shadow-sm active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {uploadSummary.active > 0 ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>{uploadSummary.pct}%</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    <span>上传</span>
                  </>
                )}
              </button>
            </div>
          </div>

		          {/* 桌面端：面包屑单独一行显示，避免被按钮挤压 */}
		          <div className="hidden md:flex items-center justify-between gap-3 px-6 py-2 border-t border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900">
		            <div className="flex flex-wrap items-center gap-1 text-sm text-gray-600 dark:text-gray-300 min-w-0">
		              <button
		                onClick={() => {
		                  setPath([]);
	                  setSearchTerm("");
		                }}
		                className="hover:bg-gray-100 px-2 py-1 rounded-md transition-colors text-gray-500 flex items-center gap-1 dark:text-gray-300 dark:hover:bg-gray-800"
		              >
		                <FolderOpen className="w-5 h-5 text-gray-500 dark:text-gray-300" strokeWidth={1.75} />
		                <span className="text-sm font-medium text-gray-600 dark:text-gray-300">根目录</span>
		              </button>
	              {path.length > 0 && <ChevronRight className="w-4 h-4 text-gray-300 shrink-0 dark:text-gray-600" />}
	              {path.map((folder, idx) => (
                <React.Fragment key={idx}>
                  <button
                    onClick={() => handleBreadcrumbClick(idx)}
                    className="hover:text-blue-600 hover:bg-blue-50 px-2 py-1 rounded-md transition-colors font-medium break-words dark:hover:text-blue-200 dark:hover:bg-blue-950/30"
                  >
                    {folder}
                  </button>
                  {idx < path.length - 1 && <ChevronRight className="w-4 h-4 text-gray-300 shrink-0 dark:text-gray-600" />}
                </React.Fragment>
	              ))}
		            </div>
		            <BucketHintChip
		              bucketName={selectedBucketDisplayName ?? "未选择"}
		              disabled={!selectedBucket}
		              onClick={() => setBucketHintOpen(true)}
		            />
		          </div>

          {/* 移动端：分行布局，避免按钮挤压 */}
          <div className="md:hidden px-3 py-2 space-y-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setMobileNavOpen(true)}
                className="p-2.5 -ml-1 rounded-lg text-gray-600 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800"
                aria-label="打开菜单"
              >
                <Menu className="w-5 h-5" />
              </button>
			            <div className="flex items-center gap-3 min-w-0">
			              <BrandMark className="w-10 h-10 shrink-0" />
				              <div className="min-w-0">
					                <div className="font-bold text-[18px] leading-[1.15] tracking-tight text-blue-600 truncate dark:text-blue-400">
					                  Qing&apos;s R2 Admin
					                </div>
					                <div className="mt-0.25 text-[12px] leading-[1.1] text-gray-400 font-medium truncate dark:text-gray-400">
					                  {LOGIN_PAGE.subtitle}
					                </div>
					              </div>
			            </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
                <input
                  type="text"
                  placeholder="桶内搜索..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-9 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all dark:bg-gray-950 dark:border-gray-800 dark:text-gray-100 dark:placeholder:text-gray-500"
                />
                {searchLoading ? (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <RefreshCw className="w-4 h-4 text-gray-400 animate-spin dark:text-gray-500" />
                  </div>
                ) : null}
              </div>
              <button
                onClick={() => {
                  if (!selectedBucket) return;
                  if (uploadTasks.length > 0) setUploadPanelOpen(true);
                  else fileInputRef.current?.click();
                }}
                disabled={!selectedBucket}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-all shadow-sm active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
              >
                <Upload className="w-4 h-4" />
                <span>上传</span>
              </button>
            </div>

            <div className="flex items-center gap-2 overflow-x-auto -mx-3 px-3 pb-0.5">
              <button
                onClick={() => selectedBucket && fetchFiles(selectedBucket, path)}
                disabled={!selectedBucket}
                className="w-16 h-14 flex flex-col items-center justify-center gap-1 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 dark:text-gray-200 dark:hover:bg-gray-800"
                title="刷新"
                aria-label="刷新"
              >
                <RefreshCw className={`w-5 h-5 ${loading ? "animate-spin" : ""}`} />
                <span className="text-[10px] leading-none text-gray-500 dark:text-gray-400">刷新</span>
              </button>
              <button
                onClick={handleBatchDownload}
                disabled={selectedKeys.size === 0}
                className="w-16 h-14 flex flex-col items-center justify-center gap-1 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 dark:text-gray-200 dark:hover:bg-gray-800"
                title="批量下载（所选文件）"
                aria-label="下载"
              >
                <Download className="w-5 h-5" />
                <span className="text-[10px] leading-none text-gray-500 dark:text-gray-400">下载</span>
              </button>
              <button
                onClick={openBatchMove}
                disabled={selectedKeys.size === 0}
                className="w-16 h-14 flex flex-col items-center justify-center gap-1 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 dark:text-gray-200 dark:hover:bg-gray-800"
                title="批量移动（所选文件）"
                aria-label="移动"
              >
                <ArrowRightLeft className="w-5 h-5" />
                <span className="text-[10px] leading-none text-gray-500 dark:text-gray-400">移动</span>
              </button>
              <button
                onClick={handleRenameFromToolbar}
                disabled={selectedKeys.size > 1 || (selectedKeys.size === 0 && !selectedItem)}
                className="w-16 h-14 flex flex-col items-center justify-center gap-1 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 dark:text-gray-200 dark:hover:bg-gray-800"
                title="重命名（仅支持单选）"
                aria-label="重命名"
              >
                <Edit2 className="w-5 h-5" />
                <span className="text-[10px] leading-none text-gray-500 dark:text-gray-400">重命名</span>
              </button>
              <button
                onClick={handleDelete}
                disabled={selectedKeys.size === 0 && !selectedItem}
                className="w-16 h-14 flex flex-col items-center justify-center gap-1 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 dark:text-red-200 dark:hover:bg-red-950/40"
                title="删除（所选项）"
                aria-label="删除"
              >
                <Trash2 className="w-5 h-5" />
                <span className="text-[10px] leading-none">删除</span>
              </button>
              <button
                onClick={openMkdir}
                disabled={!selectedBucket || !!searchTerm.trim()}
                className="w-16 h-14 flex flex-col items-center justify-center gap-1 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 dark:text-gray-200 dark:hover:bg-gray-800"
                title={searchTerm.trim() ? "搜索中无法新建文件夹" : "新建文件夹"}
                aria-label="新建"
              >
                <FolderPlus className="w-5 h-5" />
                <span className="text-[10px] leading-none text-gray-500 dark:text-gray-400">新建</span>
              </button>
              <button
                type="button"
                onClick={() =>
                  setThemeMode((prev) =>
                    prev === "system" ? (resolvedDark ? "light" : "dark") : prev === "dark" ? "light" : "system",
                  )
                }
                className="w-16 h-14 flex flex-col items-center justify-center gap-1 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors active:scale-95 dark:text-gray-200 dark:hover:bg-gray-800"
                title={themeMode === "system" ? "主题：跟随系统" : themeMode === "dark" ? "主题：深色" : "主题：浅色"}
                aria-label="主题"
              >
                {themeMode === "dark" ? (
                  <Moon className="w-5 h-5" />
                ) : themeMode === "light" ? (
                  <Sun className="w-5 h-5" />
                ) : (
                  <Monitor className="w-5 h-5" />
                )}
                <span className="text-[10px] leading-none text-gray-500 dark:text-gray-400">主题</span>
              </button>
            </div>

		            {/* 移动端：面包屑移动到功能区下方、文件列表上方 */}
		            <div className="pt-1">
		              <div className="flex items-center justify-between gap-2">
		                <div className="flex flex-wrap items-center gap-1 text-sm text-gray-600 dark:text-gray-300 min-w-0">
		                  <button
		                    onClick={() => {
		                      setPath([]);
	                      setSearchTerm("");
		                    }}
		                    className="hover:bg-gray-100 px-2 py-1 rounded-md transition-colors text-gray-500 flex items-center gap-1 dark:text-gray-300 dark:hover:bg-gray-800"
		                  >
		                    <FolderOpen className="w-5 h-5 text-gray-500 dark:text-gray-300" strokeWidth={1.75} />
		                    <span className="text-sm font-medium">根目录</span>
		                  </button>
	                  {path.length > 0 && <ChevronRight className="w-4 h-4 text-gray-300 shrink-0 dark:text-gray-600" />}
	                  {path.map((folder, idx) => (
	                    <React.Fragment key={idx}>
	                      <button
	                        onClick={() => handleBreadcrumbClick(idx)}
	                        className="hover:text-blue-600 hover:bg-blue-50 px-2 py-1 rounded-md transition-colors font-medium whitespace-nowrap dark:hover:text-blue-200 dark:hover:bg-blue-950/30"
	                      >
	                        {folder}
	                      </button>
	                      {idx < path.length - 1 && (
	                        <ChevronRight className="w-4 h-4 text-gray-300 shrink-0 dark:text-gray-600" />
	                      )}
	                    </React.Fragment>
	                  ))}
	                </div>
	                <BucketHintChip
	                  bucketName={selectedBucketDisplayName ?? "未选择"}
	                  disabled={!selectedBucket}
	                  onClick={() => setBucketHintOpen(true)}
	                  className="shrink-0"
	                />
	              </div>
	            </div>
	          </div>
	        </div>

        <input type="file" multiple ref={fileInputRef} className="hidden" onChange={handleUpload} />

        {loading || searchLoading ? (
          <div className="h-1 w-full bg-blue-100 dark:bg-blue-950/40">
            <div className="h-1 w-1/3 bg-blue-500 animate-pulse" />
          </div>
        ) : (
          <div className="h-1 w-full bg-transparent" />
        )}

        {/* 文件列表 */}
        <div
          className={`flex-1 overflow-y-auto p-3 md:py-4 md:px-6 bg-gray-50/30 dark:bg-gray-900 ${loading ? "pointer-events-none" : ""}`}
          onClick={() => {
            setSelectedItem(null);
          }}
        >
          {connectionStatus === "unbound" ? (
            <div className="h-full flex items-center justify-center">
              <div className="w-full max-w-2xl bg-white border border-gray-200 rounded-2xl shadow-sm p-6 dark:bg-gray-900 dark:border-gray-800">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-sm font-semibold text-gray-800 dark:text-gray-100">未绑定存储桶</div>
                    <div className="mt-1 text-sm text-gray-500 leading-relaxed dark:text-gray-300">
                      这个站点使用 Cloudflare Pages 的 <span className="font-semibold text-gray-700 dark:text-gray-200">R2 绑定</span> 来管理文件；
                      你需要先在 Pages 项目里绑定至少 1 个 R2 存储桶。
                    </div>
                  </div>
                  <button
                    onClick={() => fetchBuckets()}
                    className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 text-sm font-medium transition-colors whitespace-nowrap"
                  >
                    重新检测
                  </button>
                </div>

                <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-950/30">
                    <div className="text-xs font-bold text-gray-500 uppercase tracking-wider dark:text-gray-400">绑定步骤（中文界面）</div>
                    <ol className="mt-3 space-y-2 text-sm text-gray-700 list-decimal pl-5 dark:text-gray-200">
                      <li>进入 Cloudflare Pages 项目</li>
                      <li>点击「设置」→「绑定」</li>
                      <li>点击「添加」中选择「R2 存储桶」</li>
                      <li>填写绑定名称,并选择你的桶</li>
                      <li>保存后重新部署，部署成功刷新即可。</li>
                    </ol>
                  </div>

                  <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-950/30">
                    <div className="text-xs font-bold text-gray-500 uppercase tracking-wider dark:text-gray-400">示例绑定名</div>
                    <div className="mt-3 text-sm text-gray-700 leading-relaxed space-y-2 dark:text-gray-200">
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-medium">博客桶</span>
                        <code className="px-2 py-1 rounded bg-white border border-gray-200 text-xs dark:bg-gray-900 dark:border-gray-800">R2_BLOG</code>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-medium">云盘桶</span>
                        <code className="px-2 py-1 rounded bg-white border border-gray-200 text-xs dark:bg-gray-900 dark:border-gray-800">R2_CLOUD</code>
                      </div>
                      <div className="text-[12px] text-gray-500 dark:text-gray-400">
                        建议以 <code className="px-1.5 py-0.5 rounded bg-white border border-gray-200 text-[11px] dark:bg-gray-900 dark:border-gray-800">R2_</code> 开头，便于自动识别与切换。
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-4 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
                  <div className="text-xs font-semibold text-gray-600 dark:text-gray-200">可选配置</div>
                  <ul className="mt-2 text-sm text-gray-700 space-y-1.5 list-disc pl-5 dark:text-gray-200">
                    <li>
                      显示中文桶名：设置环境变量{" "}
                      <code className="px-1.5 py-0.5 rounded bg-gray-50 border border-gray-200 text-[11px] dark:bg-gray-950 dark:border-gray-800">R2_BUCKETS</code>{" "}
                      ，例如{" "}
                      <code className="px-1.5 py-0.5 rounded bg-gray-50 border border-gray-200 text-[11px] dark:bg-gray-950 dark:border-gray-800">
                        R2_BLOG:博客,R2_CLOUD:云盘
                      </code>
                    </li>
                    <li>
                      访问密码：设置环境变量{" "}
                      <code className="px-1.5 py-0.5 rounded bg-gray-50 border border-gray-200 text-[11px] dark:bg-gray-950 dark:border-gray-800">ADMIN_PASSWORD</code>{" "}
                      （未设置则不会弹出登录页）
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          ) : filteredFiles.length === 0 && !loading && !searchLoading ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-400 dark:text-gray-400">
              <div className="w-24 h-24 bg-gray-50 rounded-full flex items-center justify-center mb-4 dark:bg-gray-950">
                <Folder className="w-10 h-10 text-gray-300 dark:text-gray-600" />
              </div>
              <p className="text-sm font-medium">{searchTerm.trim() ? "未找到匹配内容" : "文件夹为空"}</p>
            </div>
          ) : (
            <React.Fragment>
                <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm dark:bg-gray-900 dark:border-gray-800">
                  <div className="flex items-center px-4 py-3 sm:py-2.5 text-[11px] font-semibold text-gray-500 bg-gray-50 border-b border-gray-200 dark:bg-gray-950/30 dark:border-gray-800 dark:text-gray-400">
                    <div className="w-10 flex items-center justify-center">
                      <input
                        type="checkbox"
                        aria-label="Select all"
                        checked={filteredFiles.length > 0 && filteredFiles.every((f) => selectedKeys.has(f.key))}
                        onChange={(e) => {
                          const next = new Set(selectedKeys);
                          if (e.target.checked) {
                            for (const f of filteredFiles) next.add(f.key);
                          } else {
                            for (const f of filteredFiles) next.delete(f.key);
                          }
                          setSelectedKeys(next);
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="w-5 h-5 sm:w-4 sm:h-4"
                      />
                    </div>
                    <div className="flex-1">名称</div>
                    <div className="w-28 text-right hidden md:block">大小</div>
                    <div className="w-28 text-right hidden md:block">修改时间</div>
                    <div className="w-40 text-right hidden md:block">操作</div>
                    <div className="w-12 text-right md:hidden">操作</div>
                  </div>
                  <div>
                    {filteredFiles.map((file) => {
                      const checked = selectedKeys.has(file.key);
                      return (
                        <div
                          key={file.key}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (isMobile) {
                              if (file.type === "folder") handleEnterFolder(file.name);
                              else previewItem(file);
                              return;
                            }
                            setSelectedItem(file);
                          }}
                          onDoubleClick={(e) => {
                            e.stopPropagation();
                            if (isMobile) return;
                            if (file.type === "folder") handleEnterFolder(file.name);
                            else previewItem(file);
                          }}
                          className={`group flex items-center px-4 py-3 md:py-2.5 text-sm border-b border-gray-100 hover:bg-gray-50 cursor-pointer dark:border-gray-800 dark:hover:bg-gray-800 ${
                            selectedItem?.key === file.key ? "bg-blue-50 dark:bg-blue-950/30" : "bg-white dark:bg-gray-900"
                          }`}
                        >
                          <div className="w-10 flex items-center justify-center">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => {
                                const next = new Set(selectedKeys);
                                if (e.target.checked) next.add(file.key);
                                else next.delete(file.key);
                                setSelectedKeys(next);
                              }}
                              onClick={(e) => e.stopPropagation()}
                              className="w-5 h-5 sm:w-4 sm:h-4"
                            />
                          </div>
                          <div className="flex-1 min-w-0 flex items-center gap-2">
                            <div className="shrink-0">{getIcon(file.type, file.name, "sm")}</div>
                            <div className="min-w-0 flex items-center gap-2">
                          <div className="truncate" title={file.name}>{file.name}</div>
                              <span className="shrink-0 text-[10px] px-2 py-0.5 rounded-full border border-gray-200 bg-white text-gray-600 font-semibold dark:border-gray-800 dark:bg-gray-900 dark:text-gray-200">
                                {getFileTag(file)}
                              </span>
                            </div>
                          </div>
                          <div className="w-28 text-right text-xs text-gray-500 hidden md:block dark:text-gray-400">
                            {file.type === "folder" ? "-" : formatSize(file.size)}
                          </div>
                          <div className="w-28 text-right text-xs text-gray-500 hidden md:block dark:text-gray-400">
                            {file.lastModified ? new Date(file.lastModified).toLocaleDateString() : "-"}
                          </div>
                          <div className="w-40 hidden md:flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            {file.type === "folder" ? (
                              <>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleEnterFolder(file.name);
                                  }}
                                  className="p-3 sm:p-2 rounded-lg hover:bg-gray-100 text-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
                                  title="打开"
                                >
                                  <FolderOpen className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openRenameFor(file);
                                  }}
                                  className="p-3 sm:p-2 rounded-lg hover:bg-gray-100 text-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
                                  title="重命名"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openMoveFor(file, "move");
                                  }}
                                  className="p-3 sm:p-2 rounded-lg hover:bg-gray-100 text-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
                                  title="移动"
                                >
                                  <ArrowRightLeft className="w-4 h-4" />
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    downloadItem(file);
                                  }}
                                  className="p-3 sm:p-2 rounded-lg hover:bg-gray-100 text-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
                                  title="下载"
                                >
                                  <Download className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openRenameFor(file);
                                  }}
                                  className="p-3 sm:p-2 rounded-lg hover:bg-gray-100 text-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
                                  title="重命名"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openMoveFor(file, "move");
                                  }}
                                  className="p-3 sm:p-2 rounded-lg hover:bg-gray-100 text-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
                                  title="移动"
                                >
                                  <ArrowRightLeft className="w-4 h-4" />
                                </button>
                              </>
                            )}
                          </div>
                          <div className="w-12 flex justify-end md:hidden">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedItem(file);
                                setMobileDetailOpen(true);
                              }}
                              className="px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white text-xs font-medium text-gray-700 hover:bg-gray-50 active:scale-95 transition dark:border-gray-800 dark:bg-gray-900 dark:text-gray-100 dark:hover:bg-gray-800"
                              aria-label="操作"
                              title="操作"
                            >
                              操作
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
            </React.Fragment>
          )}
        </div>
      </main>

      {/* 桌面端：右侧信息面板 */}
      <div className="hidden md:flex w-80 shrink-0">
        <DetailsPanel />
      </div>

	      {/* 移动端：详情底部弹窗 */}
	      <div className={`fixed inset-0 z-50 md:hidden ${mobileDetailOpen ? "" : "pointer-events-none"}`}>
	        <button
	          type="button"
	          aria-label="关闭详情"
	          onClick={() => setMobileDetailOpen(false)}
	          className={`absolute inset-0 bg-black/40 transition-opacity ${mobileDetailOpen ? "opacity-100" : "opacity-0"}`}
	        />
	        <div
	          className={`absolute inset-x-0 bottom-0 transition-transform duration-200 ${
	            mobileDetailOpen ? "translate-y-0" : "translate-y-full"
	          }`}
	          onClick={(e) => e.stopPropagation()}
	        >
	          <div className="h-[70dvh] bg-white rounded-t-2xl shadow-2xl border border-gray-200 overflow-hidden dark:bg-gray-900 dark:border-gray-800">
	            <DetailsPanel compact onClose={() => setMobileDetailOpen(false)} />
	          </div>
	        </div>
	      </div>

      {/* 旧版：右侧信息面板（已弃用） */}
      {false ? (
      <div className="w-80 bg-white border-l border-gray-200 flex flex-col shadow-sm z-10">
        <div className="p-5 border-b border-gray-100">
          <h2 className="font-bold text-gray-800 text-sm uppercase tracking-wide">详细信息</h2>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          {selectedItem ? (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="flex flex-col items-center">
                <div className="w-24 h-24 bg-gray-50 rounded-2xl border border-gray-100 flex items-center justify-center mb-4 shadow-sm">
                  {getIcon(selectedItem!.type, selectedItem!.name)}
                </div>
                <h3 className="font-semibold text-gray-900 text-center break-all px-2 leading-snug">{selectedItem!.name}</h3>
                <div className="mt-2 inline-flex items-center gap-2">
                  <span className="text-[10px] px-2 py-0.5 rounded-full border border-gray-200 bg-white text-gray-600 font-semibold">
                    {getFileTag(selectedItem!)}
                  </span>
                  {selectedItem!.type === "file" ? (
                    <span className="text-[10px] text-gray-400 font-medium">{formatSize(selectedItem!.size)}</span>
                  ) : null}
                </div>
              </div>
              
              <div className="space-y-0 text-sm border rounded-lg border-gray-100 overflow-hidden">
                <div className="flex justify-between p-3 bg-gray-50/50 border-b border-gray-100">
                  <span className="text-gray-500">类型</span>
                  <span className="text-gray-900 font-medium">{selectedItem!.type === "folder" ? "文件夹" : "文件"}</span>
                </div>
                <div className="flex justify-between p-3 bg-white border-b border-gray-100">
                  <span className="text-gray-500">大小</span>
                  <span className="text-gray-900 font-medium">{formatSize(selectedItem!.size)}</span>
                </div>
                <div className="flex justify-between p-3 bg-gray-50/50">
                  <span className="text-gray-500">修改时间</span>
                  <span className="text-gray-900 font-medium text-right text-xs">
                    {selectedItem!.lastModified ? new Date(selectedItem!.lastModified as string).toLocaleDateString() : "-"}
                  </span>
                </div>
              </div>

              {selectedItem!.type === "folder" ? (
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <button
                    onClick={() => handleEnterFolder(selectedItem!.name)}
                    className="flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg text-sm font-medium transition-colors col-span-2"
                  >
                    <FolderOpen className="w-4 h-4" />
                    打开文件夹
                  </button>
                  <button
                    onClick={handleRename}
                    className="flex items-center justify-center gap-2 px-3 py-2 bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 hover:text-blue-600 rounded-lg text-sm font-medium transition-colors"
                  >
                    <Edit2 className="w-4 h-4" />
                    重命名
                  </button>
                  <button
                    onClick={() => handleMoveOrCopy("move")}
                    className="flex items-center justify-center gap-2 px-3 py-2 bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 hover:text-blue-600 rounded-lg text-sm font-medium transition-colors"
                  >
                    <ArrowRightLeft className="w-4 h-4" />
                    移动
                  </button>
                  <button
                    onClick={() => handleMoveOrCopy("copy")}
                    className="flex items-center justify-center gap-2 px-3 py-2 bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 hover:text-blue-600 rounded-lg text-sm font-medium transition-colors"
                  >
                    <Copy className="w-4 h-4" />
                    复制
                  </button>
                  <button
                    onClick={handleDelete}
                    className="flex items-center justify-center gap-2 px-3 py-2 bg-white border border-gray-200 text-red-600 hover:bg-red-50 hover:border-red-200 rounded-lg text-sm font-medium transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                    删除
                  </button>
                  <button
                    onClick={() => copyLinkForItem(selectedItem!, "public")}
                    className="flex items-center justify-center gap-2 px-3 py-2 bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 hover:text-blue-600 rounded-lg text-sm font-medium transition-colors"
                  >
                    <Link2 className="w-4 h-4" />
                    公共链接
                  </button>
                  <button
                    onClick={() => copyLinkForItem(selectedItem!, "custom")}
                    className="flex items-center justify-center gap-2 px-3 py-2 bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 hover:text-blue-600 rounded-lg text-sm font-medium transition-colors"
                  >
                    <Link2 className="w-4 h-4" />
                    自定义链接
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <button
                    onClick={() => previewItem(selectedItem!)}
                    className="flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg text-sm font-medium transition-colors col-span-2"
                  >
                    <Eye className="w-4 h-4" />
                    预览
                  </button>
                  <button
                    onClick={() => downloadItem(selectedItem!)}
                    className="flex items-center justify-center gap-2 px-3 py-2 bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 hover:text-blue-600 rounded-lg text-sm font-medium transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    下载
                  </button>
                  <button
                    onClick={handleRename}
                    className="flex items-center justify-center gap-2 px-3 py-2 bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 hover:text-blue-600 rounded-lg text-sm font-medium transition-colors"
                  >
                    <Edit2 className="w-4 h-4" />
                    重命名
                  </button>
                  <button
                    onClick={() => handleMoveOrCopy("move")}
                    className="flex items-center justify-center gap-2 px-3 py-2 bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 hover:text-blue-600 rounded-lg text-sm font-medium transition-colors"
                  >
                    <ArrowRightLeft className="w-4 h-4" />
                    移动
                  </button>
                  <button
                    onClick={() => handleMoveOrCopy("copy")}
                    className="flex items-center justify-center gap-2 px-3 py-2 bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 hover:text-blue-600 rounded-lg text-sm font-medium transition-colors"
                  >
                    <Copy className="w-4 h-4" />
                    复制
                  </button>
                  <button
                    onClick={handleDelete}
                    className="flex items-center justify-center gap-2 px-3 py-2 bg-white border border-gray-200 text-red-600 hover:bg-red-50 hover:border-red-200 rounded-lg text-sm font-medium transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                    删除
                  </button>
                  <button
                    onClick={() => copyLinkForItem(selectedItem!, "public")}
                    className="flex items-center justify-center gap-2 px-3 py-2 bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 hover:text-blue-600 rounded-lg text-sm font-medium transition-colors"
                  >
                    <Link2 className="w-4 h-4" />
                    公共链接
                  </button>
                  <button
                    onClick={() => copyLinkForItem(selectedItem!, "custom")}
                    className="flex items-center justify-center gap-2 px-3 py-2 bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 hover:text-blue-600 rounded-lg text-sm font-medium transition-colors"
                  >
                    <Link2 className="w-4 h-4" />
                    自定义链接
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <Search className="w-6 h-6 text-gray-300" />
              </div>
              <p className="text-gray-500 text-sm">选择一个文件以查看详情<br/>或进行管理</p>
            </div>
          )}

          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-5 border border-blue-100">
            <h3 className="text-[10px] font-bold text-blue-800 uppercase tracking-wider mb-4 flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
              当前视图统计
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-500">文件数</span>
                <span className="text-sm font-bold text-gray-800">{currentViewStats.fileCount}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-500">文件夹数</span>
                <span className="text-sm font-bold text-gray-800">{currentViewStats.folderCount}</span>
              </div>
              <div className="h-px bg-blue-200/50 my-2"></div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-500">总大小</span>
                <span className="text-sm font-bold text-blue-700">{formatSize(currentViewStats.totalSize)}</span>
              </div>
            </div>
          </div>
        </div>
        
        <div className="p-4 border-t border-gray-100 bg-gray-50 text-[10px] text-gray-400 text-center">
          <p>Qing&apos;s R2 Admin</p>
          <p className="mt-0.5">R2对象存储多功能管理工具</p>
        </div>
      </div>
      ) : null}

	      <Modal
	        open={bucketHintOpen}
	        title="当前存储桶"
	        description="主页仅展示（不支持切换）；如需切换请在侧边栏/菜单中操作。"
	        onClose={() => setBucketHintOpen(false)}
	        footer={
	          <div className="flex justify-end">
	            <button
	              onClick={() => setBucketHintOpen(false)}
	              className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 text-sm font-medium"
	            >
	              知道了
	            </button>
	          </div>
	        }
	      >
	        <div className="space-y-2">
	          <div className="text-xs text-gray-500 dark:text-gray-400">桶名称</div>
	          <div className="text-base font-semibold text-gray-900 break-all dark:text-gray-100">
	            {selectedBucketDisplayName ?? "未选择"}
	          </div>
	        </div>
	      </Modal>

	      <Modal
	        open={mkdirOpen}
	        title="新建文件夹"
	        description={path.length ? `当前位置：/${path.join("/")}/` : "当前位置：/（根目录）"}
	        onClose={() => { setMkdirOpen(false); setMkdirName(""); }}
        footer={
          <div className="flex justify-end gap-2">
            <button
              onClick={() => { setMkdirOpen(false); setMkdirName(""); }}
              className="px-4 py-2 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 text-sm font-medium dark:border-gray-800 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              取消
            </button>
            <button
              onClick={executeMkdir}
              className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 text-sm font-medium"
            >
              创建
            </button>
          </div>
        }
      >
        <label className="block text-sm font-medium text-gray-700 mb-2 dark:text-gray-200">文件夹名称</label>
        <input
          value={mkdirName}
          onChange={(e) => setMkdirName(e.target.value)}
          className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none dark:bg-gray-950 dark:border-gray-800 dark:text-gray-100 dark:placeholder:text-gray-500"
          placeholder="例如：images"
        />
      </Modal>

      <Modal
        open={renameOpen}
        title="重命名"
        description={selectedItem ? `当前：${selectedItem.name}` : undefined}
        onClose={() => setRenameOpen(false)}
        footer={
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setRenameOpen(false)}
              className="px-4 py-2 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 text-sm font-medium dark:border-gray-800 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              取消
            </button>
            <button
              onClick={executeRename}
              className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 text-sm font-medium"
            >
              确认
            </button>
          </div>
        }
      >
        <label className="block text-sm font-medium text-gray-700 mb-2 dark:text-gray-200">新名称</label>
        <input
          value={renameValue}
          onChange={(e) => setRenameValue(e.target.value)}
          className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none dark:bg-gray-950 dark:border-gray-800 dark:text-gray-100 dark:placeholder:text-gray-500"
          placeholder="输入新名称"
        />
      </Modal>

      <Modal
        open={moveOpen}
        title={moveMode === "move" ? "移动" : "复制"}
        description={
          moveSources.length > 1
            ? `已选择 ${moveSources.length} 个文件`
            : selectedItem
              ? `对象：${selectedItem.key}`
              : undefined
        }
        onClose={() => { setMoveOpen(false); setMoveSources([]); }}
        footer={
          <div className="flex justify-end gap-2">
            <button
              onClick={() => { setMoveOpen(false); setMoveSources([]); }}
              className="px-4 py-2 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 text-sm font-medium dark:border-gray-800 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              取消
            </button>
            <button
              onClick={executeMoveOrCopy}
              className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 text-sm font-medium"
            >
              确认
            </button>
          </div>
        }
      >
        <label className="block text-sm font-medium text-gray-700 mb-2 dark:text-gray-200">目标路径</label>
        <input
          value={moveTarget}
          onChange={(e) => setMoveTarget(e.target.value)}
          className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none dark:bg-gray-950 dark:border-gray-800 dark:text-gray-100 dark:placeholder:text-gray-500"
          placeholder="例如：photos/ 或 a/b/c/"
        />
        <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">以 `/` 结尾表示目标目录；不以 `/` 结尾表示目标 Key。</div>
      </Modal>

      <Modal
        open={logoutOpen}
        title="确认退出登录？"
        onClose={() => setLogoutOpen(false)}
        footer={
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setLogoutOpen(false)}
              className="px-4 py-2 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 text-sm font-medium dark:border-gray-800 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              取消
            </button>
            <button
              onClick={() => {
                setLogoutOpen(false);
                handleLogout();
              }}
              className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 text-sm font-medium"
            >
              退出登录
            </button>
          </div>
        }
      >
        <div className="text-sm text-gray-700 dark:text-gray-200">退出后将清除本地登录状态，需要重新输入管理账号和密码才能继续使用。确定退出登录吗？</div>
      </Modal>

      <Modal
        open={linkOpen}
        title="链接设置"
        description={selectedBucket ? `桶：${selectedBucket}` : undefined}
        onClose={() => setLinkOpen(false)}
        footer={
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setLinkOpen(false)}
              className="px-4 py-2 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 text-sm font-medium dark:border-gray-800 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              取消
            </button>
            <button
              onClick={saveLinkConfig}
              className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 text-sm font-medium"
            >
              保存
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2 dark:text-gray-200">公共开发 URL（可选）</label>
            <input
              value={linkPublic}
              onChange={(e) => setLinkPublic(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none dark:bg-gray-950 dark:border-gray-800 dark:text-gray-100 dark:placeholder:text-gray-500"
              placeholder="例如：pub-xxxx.r2.dev"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2 dark:text-gray-200">S3 桶名（用于预签名直连，可选）</label>
            <input
              value={linkS3BucketName}
              onChange={(e) => setLinkS3BucketName(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none dark:bg-gray-950 dark:border-gray-800 dark:text-gray-100 dark:placeholder:text-gray-500"
              placeholder="例如：qinghub-top"
            />
            <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">填写 Cloudflare R2 的真实桶名后，可在不额外配置映射环境变量的情况下启用 S3 预签名直连。</div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2 dark:text-gray-200">自定义域名（可选）</label>
            <input
              value={linkCustom}
              onChange={(e) => setLinkCustom(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none dark:bg-gray-950 dark:border-gray-800 dark:text-gray-100 dark:placeholder:text-gray-500"
              placeholder="例如：media.example.com"
            />
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">支持不带协议；会自动补全为 `https://` 并保证以 `/` 结尾。</div>
        </div>
      </Modal>

      <Modal
        open={deleteOpen}
        title="确认删除"
        description={
          selectedKeys.size > 0
            ? `将删除 ${selectedKeys.size} 项`
            : selectedItem
              ? `将删除：${selectedItem.key}`
              : undefined
        }
        onClose={() => setDeleteOpen(false)}
        footer={
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setDeleteOpen(false)}
              className="px-4 py-2 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 text-sm font-medium dark:border-gray-800 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              取消
            </button>
            <button
              onClick={executeDelete}
              className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 text-sm font-medium"
            >
              删除
            </button>
          </div>
        }
      >
        <div className="text-sm text-gray-700 dark:text-gray-200">
          确定删除文件？此操作不可恢复。
          {selectedKeys.size > 0
            ? Array.from(selectedKeys).some((k) => k.endsWith("/"))
              ? "（选择文件夹时，文件夹内的所有文件都将会被删除）"
              : null
            : selectedItem?.type === "folder"
              ? "（文件夹会递归删除前缀下的所有对象）"
              : null}
        </div>
      </Modal>

      {uploadTasks.length > 0 ? (
        <>
          <button
            onClick={() => setUploadPanelOpen((v) => !v)}
            className="fixed bottom-5 right-5 z-40 flex items-center gap-2 px-4 py-2 rounded-full bg-gray-900 text-white shadow-lg hover:bg-gray-800"
          >
            <Upload className="w-4 h-4" />
            <span className="text-sm font-medium">
              上传 {uploadSummary.active ? `(${uploadSummary.active})` : ""}
            </span>
            <span className="text-xs text-gray-200">{uploadSummary.pct}%</span>
          </button>

          {uploadPanelOpen ? (
            <div className="fixed bottom-20 right-5 z-40 w-[420px] max-w-[calc(100vw-2.5rem)] bg-white border border-gray-200 rounded-2xl shadow-2xl overflow-hidden dark:bg-gray-900 dark:border-gray-800">
              <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between dark:border-gray-800">
                <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">上传任务</div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 text-xs font-medium"
                  >
                    添加文件
                  </button>
                  <button
                    onClick={() =>
                      setUploadTasks((prev) => prev.filter((t) => t.status === "queued" || t.status === "uploading" || t.status === "paused"))
                    }
                    className="px-3 py-1.5 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 text-xs font-medium dark:border-gray-800 dark:text-gray-200 dark:hover:bg-gray-800"
                  >
                    清理已完成
                  </button>
                  <button
                    onClick={() => setUploadPanelOpen(false)}
                    className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
                    title="关闭"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="max-h-[50vh] overflow-auto divide-y divide-gray-100 dark:divide-gray-800">
                {uploadTasks.map((t) => {
                  const pct = t.file.size ? Math.min(100, Math.round((Math.min(t.loaded, t.file.size) / t.file.size) * 100)) : 0;
                  return (
                    <div key={t.id} className="px-4 py-3">
	                      <div className="flex items-start justify-between gap-3">
	                        <div className="min-w-0">
	                          <div className="text-sm font-medium text-gray-900 truncate dark:text-gray-100" title={t.key}>
	                            {t.file.name}
	                          </div>
	                          <div className="mt-0.5 text-[11px] text-gray-500 truncate dark:text-gray-400" title={`${t.bucket}/${t.key}`}>
	                            {t.bucket}/{t.key}
	                          </div>
	                        </div>
	                        <div className="shrink-0 flex items-center gap-2">
	                          <div className="text-right">
	                            <div className="text-xs font-semibold text-gray-800 dark:text-gray-100">{pct}%</div>
	                            <div className="text-[11px] text-gray-500 dark:text-gray-400">
                              {t.status === "uploading"
                                ? formatSpeed(t.speedBps)
                                : t.status === "done"
                                  ? "完成"
                                  : t.status === "queued"
                                    ? "排队中"
                                    : t.status === "paused"
                                      ? "已暂停"
                                      : t.status === "canceled"
                                        ? "已取消"
                                        : t.status === "error"
                                          ? "失败"
                                          : t.status}
                            </div>
	                          </div>
	                          {t.status === "uploading" ? (
	                            <>
	                              <button
	                                onClick={() => pauseUploadTask(t.id)}
	                                className="p-2 rounded-lg hover:bg-gray-100 text-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
	                                title="暂停"
	                              >
	                                <Pause className="w-4 h-4" />
	                              </button>
	                              <button
	                                onClick={() => cancelUploadTask(t.id)}
	                                className="p-2 rounded-lg hover:bg-gray-100 text-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
	                                title="取消"
	                              >
	                                <CircleX className="w-4 h-4" />
	                              </button>
	                            </>
	                          ) : t.status === "paused" ? (
	                            <>
	                              <button
	                                onClick={() => resumeUploadTask(t.id)}
	                                className="p-2 rounded-lg hover:bg-gray-100 text-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
	                                title="继续"
	                              >
	                                <Play className="w-4 h-4" />
	                              </button>
	                              <button
	                                onClick={() => cancelUploadTask(t.id)}
	                                className="p-2 rounded-lg hover:bg-gray-100 text-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
	                                title="取消"
	                              >
	                                <CircleX className="w-4 h-4" />
	                              </button>
	                            </>
	                          ) : t.status === "queued" ? (
	                            <button
	                              onClick={() => cancelUploadTask(t.id)}
	                              className="p-2 rounded-lg hover:bg-gray-100 text-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
	                              title="取消"
	                            >
	                              <CircleX className="w-4 h-4" />
	                            </button>
	                          ) : t.status === "error" ? (
	                            <button
	                              onClick={() => resumeUploadTask(t.id)}
	                              className="p-2 rounded-lg hover:bg-gray-100 text-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
	                              title="重试"
	                            >
	                              <Play className="w-4 h-4" />
	                            </button>
	                          ) : null}
	                        </div>
	                      </div>
	                      <div className="mt-2 h-2 bg-gray-100 rounded-full overflow-hidden dark:bg-gray-800">
	                        <div
	                          className={`h-2 ${
	                            t.status === "error"
	                              ? "bg-red-500"
	                              : t.status === "done"
	                                ? "bg-green-500"
	                                : t.status === "paused" || t.status === "canceled"
	                                  ? "bg-gray-400"
	                                  : "bg-blue-600"
	                          }`}
	                          style={{ width: `${pct}%` }}
	                        />
	                      </div>
                      {t.status === "error" ? <div className="mt-2 text-[11px] text-red-600 dark:text-red-300">{t.error ?? "上传失败"}</div> : null}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}
        </>
      ) : null}

      {ToastView}

      {preview ? (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-6"
          onClick={() => setPreview(null)}
        >
          <div
            className="w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden dark:bg-gray-900 dark:border-gray-800"
            onClick={(e) => e.stopPropagation()}
          >
	            <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between gap-3 dark:border-gray-800">
	              <div className="min-w-0">
	                <div className="text-sm font-semibold text-gray-900 truncate dark:text-gray-100" title={preview.name}>
	                  {preview.name}
	                </div>
	                <div className="text-[11px] text-gray-500 truncate dark:text-gray-400" title={preview.key}>
	                  {preview.key}
	                </div>
	              </div>
	              <div className="flex items-center gap-2">
	                <span className="hidden sm:inline-flex text-[10px] px-2 py-0.5 rounded-full border border-gray-200 bg-white text-gray-600 font-semibold dark:border-gray-800 dark:bg-gray-900 dark:text-gray-200">
	                  {getFileExt(preview.name).toUpperCase() || "FILE"}
	                </span>
	                <button
	                  onClick={async () => {
	                    try {
	                      const url = await getSignedDownloadUrlForced(preview.bucket, preview.key, preview.name);
	                      triggerDownloadUrl(url, preview.name);
	                      setToast("已拉起下载");
	                    } catch {
	                      setToast("下载失败");
	                    }
	                  }}
	                  className="p-2 rounded-lg text-gray-600 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800"
	                  title="下载"
	                >
	                  <Download className="w-4 h-4" />
	                </button>
	                <button
	                  onClick={() => setPreview(null)}
	                  className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
	                  title="关闭"
	                >
	                  <X className="w-4 h-4" />
	                </button>
	              </div>
	            </div>
	            <div className="p-4 bg-gray-50 dark:bg-gray-950/30">
	              {preview.kind === "image" ? (
	                <div className="flex items-center justify-center">
	                  <img src={preview.url} alt={preview.name} className="max-h-[70vh] max-w-full rounded-lg shadow" />
	                </div>
	              ) : preview.kind === "video" ? (
	                <div className="w-full aspect-video rounded-lg shadow bg-black overflow-hidden">
	                  <video src={preview.url} controls className="w-full h-full object-contain" />
	                </div>
	              ) : preview.kind === "audio" ? (
	                <audio src={preview.url} controls className="w-full" />
	              ) : preview.kind === "pdf" ? (
	                <iframe
	                  src={preview.url}
	                  className="w-full h-[70vh] rounded-lg shadow bg-white dark:bg-gray-900"
	                  title="PDF Preview"
	                />
	              ) : preview.kind === "office" ? (
	                <iframe
	                  src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(preview.url)}`}
	                  className="w-full h-[70vh] rounded-lg shadow bg-white dark:bg-gray-900"
	                  title="Office Preview"
	                />
	              ) : preview.kind === "text" ? (
	                <pre className="text-xs bg-white border border-gray-200 rounded-lg p-4 overflow-auto max-h-[70vh] whitespace-pre-wrap dark:bg-gray-900 dark:border-gray-800 dark:text-gray-100">
	                  {preview.text ?? "加载中..."}
	                </pre>
	              ) : (
	                <div className="bg-white border border-gray-200 rounded-xl p-10 flex flex-col items-center justify-center text-center dark:bg-gray-900 dark:border-gray-800">
	                  <div className="w-28 h-28 rounded-full bg-gray-100 flex items-center justify-center dark:bg-gray-800">
	                    <FileCode className="w-10 h-10 text-blue-600" />
	                  </div>
	                  <div className="mt-8 text-2xl font-semibold text-gray-900 dark:text-gray-100">无法预览此文件</div>
	                  <div className="mt-3 text-sm text-gray-500 dark:text-gray-400">此文件类型暂不支持在线预览，请下载后查看。</div>
	                  <button
	                    onClick={async () => {
	                      try {
	                        const url = await getSignedDownloadUrlForced(preview.bucket, preview.key, preview.name);
	                        triggerDownloadUrl(url, preview.name);
	                        setToast("已拉起下载");
	                      } catch {
	                        setToast("下载失败");
	                      }
	                    }}
	                    className="mt-8 inline-flex items-center gap-3 px-8 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-lg"
	                  >
	                    <Download className="w-5 h-5" />
	                    下载文件
	                  </button>
	                </div>
	              )}
	            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
