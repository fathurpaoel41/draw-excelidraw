import {
  convertToExcalidrawElements,
  exportToSvg,
} from "@excalidraw/excalidraw";
import { parseMermaidToExcalidraw } from "@excalidraw/mermaid-to-excalidraw";
import type { BinaryFiles, OrderedExcalidrawElement } from "../types/workspace";

export interface MermaidTemplate {
  id: string;
  label: string;
  code: string;
}

export const MERMAID_TEMPLATES: MermaidTemplate[] = [
  {
    id: "flowchart",
    label: "Flowchart Workflow",
    code: `flowchart LR
  A[Mulai Gambar] --> B{Pilih Penyimpanan}
  B -->|Default| C[(IndexedDB Lokal)]
  B -->|Opsional| D[(Database Cloud)]
  C --> E[Export PNG / PDF]
  D --> E`,
  },
  {
    id: "sequence",
    label: "Sequence Diagram",
    code: `sequenceDiagram
  autonumber
  participant U as Pengguna
  participant FE as Draw Client
  participant API as Backend /api/draw
  participant DB as PostgreSQL
  U->>FE: Klik Simpan ke Database
  FE->>API: PUT /workspaces/:id (JWT)
  API->>DB: Update & Cek Versi
  DB-->>API: Versi Baru
  API-->>FE: 200 OK (Synced)`,
  },
  {
    id: "architecture",
    label: "Arsitektur Sistem",
    code: `flowchart TB
  subgraph Client["Browser Client-Side"]
    UI[Excalidraw Canvas]
    IDB[(IndexedDB)]
    UI --> IDB
  end
  subgraph Server["Backend Modular"]
    Auth["/api/auth"]
    Draw["/api/draw"]
    PG[(PostgreSQL)]
    Auth --> PG
    Draw --> PG
  end
  UI -.->|Sync Opsional| Draw`,
  },
  {
    id: "erd",
    label: "Entity Relationship (ERD)",
    code: `erDiagram
  USERS ||--o{ DRAW_WORKSPACES : owns
  DRAW_WORKSPACES ||--o{ DRAW_FILES : contains
  USERS {
    int id PK
    string username
  }
  DRAW_WORKSPACES {
    uuid id PK
    string judul
    string folder
    int versi
  }
  DRAW_FILES {
    uuid workspace_id PK
    string file_id PK
    string mime_type
  }`,
  },
  {
    id: "state",
    label: "State Diagram",
    code: `stateDiagram-v2
  [*] --> Lokal: Kanvas Baru
  Lokal --> Menyimpan: Autosave 800ms
  Menyimpan --> Lokal: Tersimpan di IndexedDB
  Lokal --> Cloud: Simpan ke Database
  Cloud --> Konflik: Versi Berbeda (409)
  Konflik --> Cloud: Resolusi Selesai`,
  },
];

export interface MermaidConversionResult {
  elements: OrderedExcalidrawElement[];
  files: BinaryFiles;
}

export async function convertMermaidCode(
  definition: string,
  options: { fontSize: number; elbow: boolean },
): Promise<MermaidConversionResult> {
  const trimmed = definition.trim();
  if (!trimmed) {
    throw new Error("Kode Mermaid tidak boleh kosong.");
  }

  const parsed = await parseMermaidToExcalidraw(trimmed, {
    elbow: options.elbow,
    themeVariables: {
      fontSize: `${options.fontSize}px`,
    },
  });

  const elements = convertToExcalidrawElements(parsed.elements, {
    regenerateIds: true,
  });

  return {
    elements,
    files: parsed.files ?? {},
  };
}

export async function renderMermaidPreviewSvg(
  elements: readonly OrderedExcalidrawElement[],
  files: BinaryFiles,
  darkMode: boolean,
): Promise<string> {
  const svg = await exportToSvg({
    elements: elements.filter((el) => !el.isDeleted),
    appState: {
      exportBackground: true,
      viewBackgroundColor: darkMode ? "#121212" : "#ffffff",
      exportWithDarkMode: darkMode,
    },
    files,
    exportPadding: 16,
  });

  svg.setAttribute(
    "style",
    "max-width: 100%; max-height: 100%; width: auto; height: auto;",
  );
  return new XMLSerializer().serializeToString(svg);
}
