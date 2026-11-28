// src/ui/components/icons.js
// مدیریت آیکن‌های Lucide
// توجه: keys در icons object باید PascalCase باشند (چون toPascalCase در replaceElement.js اعمال می‌شود)

import { createIcons } from 'lucide';
import {
  AlertTriangle, ArrowDown, ArrowDownCircle, ArrowDownLeft, ArrowLeftRight,
  ArrowUp, ArrowUpCircle, ArrowUpRight, Bell, Bookmark, BookmarkCheck,
  Briefcase, Calendar, Check, CheckCircle, ChevronDown, ChevronLeft,
  ChevronRight, ChevronUp, CircleHelp, Clock, Download, FileUp, Flag,
  FolderPlus, GripVertical, Home, Inbox, Info, LayoutGrid, Menu, Pencil,
  Phone, Plus, RefreshCw, Search, SearchX, Sliders, Sparkles, Tag, Wrench, Trash2,
  TrendingDown, TrendingUp, Upload, User, UserPlus, Users, Wallet, X,
  Database, ChartPie, Receipt, Mail, Settings, ArrowRightLeft,
  UserRound, BriefcaseBusiness, Rocket, Star, Leaf, Coffee, Code, Heart,
  LockKeyhole, ShieldCheck
} from 'lucide';

// کلیدها به صورت PascalCase (طبق نیاز lucide replaceElement)
const icons = {
  AlertTriangle,
  ArrowDown,
  ArrowDownCircle,
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowRightLeft,
  ArrowUp,
  ArrowUpCircle,
  ArrowUpRight,
  Bell,
  Bookmark,
  BookmarkCheck,
  Briefcase,
  Calendar,
  Check,
  CheckCircle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  CircleHelp,
  Clock,
  Download,
  FileUp,
  Flag,
  FolderPlus,
  GripVertical,
  Home,
  Inbox,
  Info,
  LayoutGrid,
  Mail,
  Menu,
  Pencil,
  Phone,
  Plus,
  RefreshCw,
  Search,
  SearchX,
  Settings,
  Sliders,
  Sparkles,
  Tag,
  Tool: Wrench,
  Wrench,
  Trash2,
  TrendingDown,
  TrendingUp,
  Upload,
  User,
  UserPlus,
  Users,
  Wallet,
  X,
  Database,
  ChartPie,
  Receipt,
  UserRound,
  BriefcaseBusiness,
  Rocket,
  Star,
  Leaf,
  Coffee,
  Code,
  Heart,
  LockKeyhole,
  ShieldCheck
};

let initialized = false;

export function refreshIcons() {
  if (typeof window !== 'undefined') {
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      window.lucide.createIcons();
    } else {
      createIcons({ icons });
    }
  }
}

export function initIcons() {
  if (typeof window !== 'undefined') {
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      window.lucide.createIcons();
    } else {
      createIcons({ icons });
    }
    initialized = true;
  }
}

export function getIcons() {
  return icons;
}

// ایجاد HTML برای آیکن با data attribute
// data-lucide با kebab-case کار می‌کند (lucide خودش به PascalCase تبدیل می‌کند)
export function icon(name, classes = 'w-4 h-4') {
  return `<i data-lucide="${name}" class="${classes}"></i>`;
}
