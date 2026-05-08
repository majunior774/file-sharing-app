export type FileRecord = {
  originalName: string;
  storedName: string;
  size: number;
  mimeType: string;
  relativePath: string;
  url: string;
};

export type ShareMeta = {
  shareId: string;
  files: FileRecord[];
  createdAt: string;
};
