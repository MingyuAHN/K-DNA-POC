"use client";

import {
  useRef,
} from "react";

import {
  FileText,
  UploadCloud,
  X,
} from "lucide-react";

type SeedUploadProps = {
  files: File[];
  disabled: boolean;

  onFilesChange: (
    files: File[]
  ) => void;

  onRemove: (
    index: number
  ) => void;
};

export default function SeedUpload({
  files,
  disabled,
  onFilesChange,
  onRemove,
}: SeedUploadProps) {
  const fileInputRef =
    useRef<HTMLInputElement | null>(
      null
    );

  const handleFileChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const selectedFiles =
      Array.from(
        event.target.files ?? []
      );

    if (
      selectedFiles.length === 0
    ) {
      return;
    }

    onFilesChange([
      ...files,
      ...selectedFiles,
    ]);

    event.target.value = "";
  };

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-sm font-bold text-slate-800">
          참고 문서 / Seed 문서{" "}
          <span className="text-rose-500">
            *
          </span>
        </h2>

        <p className="mt-0.5 text-xs font-medium text-slate-500">
          전문가 답변과 비교할 Baseline Evidence 문서를 업로드합니다.
        </p>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".pdf,.docx,.txt,.md"
        className="hidden"
        onChange={handleFileChange}
        disabled={disabled}
      />

      <button
        type="button"
        onClick={() =>
          fileInputRef.current?.click()
        }
        disabled={disabled}
        className="group flex min-h-[80px] w-full flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 py-3 transition hover:border-blue-400 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <div className="mb-1 flex h-9 w-9 items-center justify-center rounded-xl bg-blue-100 text-blue-600 transition group-hover:-translate-y-0.5">
          <UploadCloud className="h-5 w-5" />
        </div>

        <span className="text-sm font-extrabold text-slate-800">
          문서 업로드
        </span>

        <span className="mt-0.5 text-[11px] font-medium text-slate-500">
          PDF, DOCX, TXT, MD
        </span>
      </button>

      {files.length > 0 && (
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {files.map(
            (file, index) => (
              <div
                key={`${file.name}-${index}`}
                className="flex min-w-0 items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
                  <FileText className="h-4 w-4" />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-slate-800">
                    {file.name}
                  </p>

                  <p className="mt-0.5 text-[11px] font-medium text-slate-500">
                    {(
                      file.size /
                      1024 /
                      1024
                    ).toFixed(2)}{" "}
                    MB
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    onRemove(index)
                  }
                  disabled={disabled}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-rose-50 hover:text-rose-500 disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label={`${file.name} 삭제`}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )
          )}
        </div>
      )}
    </section>
  );
}