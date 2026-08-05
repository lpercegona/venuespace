import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect } from "react";
import { Heading4, List, Pilcrow } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { RICH_TEXT_MAX } from "@/lib/rich-text";

type Props = {
  value: string;
  onChange: (html: string) => void;
  /** Character limit applied to plain text (markup excluded). */
  max?: number;
  placeholder?: string;
  className?: string;
};

/**
 * Editor de texto limitado: parágrafo, título (H4) e lista com bullets.
 * Usado na descrição da organização (extensão da Iteração 18).
 */
export function RichTextEditor({ value, onChange, max = RICH_TEXT_MAX, className }: Props) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [4] },
        blockquote: false,
        codeBlock: false,
        horizontalRule: false,
        orderedList: false,
        code: false,
      }),
    ],
    content: value || "<p></p>",
    editorProps: {
      attributes: {
        class:
          "min-h-40 rounded-md border border-border bg-background p-3 text-sm leading-relaxed focus:outline-none focus-visible:ring-3 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background [&_h4]:font-display [&_h4]:text-base [&_h4]:font-semibold [&_ul]:list-disc [&_ul]:pl-5 [&_p]:mb-2 [&_li]:mb-1",
      },
    },
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });

  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    if (value && value !== current) editor.commands.setContent(value, { emitUpdate: false });
  }, [value, editor]);

  if (!editor) return null;

  const used = editor.getText().length;
  const over = used > max;
  const btn = (active: boolean) => cn("h-8 gap-1.5 px-2", active && "bg-accent text-accent-foreground");

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex flex-wrap items-center gap-1 rounded-md border border-border bg-card p-1">
        <Button
          type="button" variant="ghost" size="sm"
          className={btn(editor.isActive("paragraph"))}
          onClick={() => editor.chain().focus().setParagraph().run()}
        >
          <Pilcrow className="h-4 w-4" />Texto
        </Button>
        <Button
          type="button" variant="ghost" size="sm"
          className={btn(editor.isActive("heading", { level: 4 }))}
          onClick={() => editor.chain().focus().toggleHeading({ level: 4 }).run()}
        >
          <Heading4 className="h-4 w-4" />Título
        </Button>
        <Button
          type="button" variant="ghost" size="sm"
          className={btn(editor.isActive("bulletList"))}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <List className="h-4 w-4" />Bullets
        </Button>
      </div>
      <EditorContent editor={editor} />
      <p className={cn("text-xs", over ? "text-destructive" : "text-muted-foreground")} aria-live="polite">
        {used}/{max} caracteres
      </p>
    </div>
  );
}
