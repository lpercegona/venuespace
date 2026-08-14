import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import { useEffect, useState } from "react";
import { Bold, Italic, Heading2, Heading3, List, ListOrdered, Quote, LinkIcon, Image as ImageIcon, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { optimizeImage } from "@/lib/image-optimizer";

type Props = { value: string; onChange: (html: string) => void };

export function TiptapEditor({ value, onChange }: Props) {
  const [uploading, setUploading] = useState(false);
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] } }),
      Image.configure({ inline: false }),
      Link.configure({ openOnClick: false, HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" } }),
    ],
    content: value || "<p></p>",
    editorProps: {
      attributes: {
        class: "prose prose-sm sm:prose-base max-w-none min-h-[320px] rounded-md border border-border bg-background p-4 focus:outline-none",
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

  async function onPickImage(e: React.ChangeEvent<HTMLInputElement>) {
    const original = e.target.files?.[0];
    e.target.value = "";
    if (!original || !editor) return;
    setUploading(true);
    try {
      const file = await optimizeImage(original);
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user?.id ?? "anon";
      const safe = file.name.replace(/[^a-zA-Z0-9._-]+/g, "_");
      const path = `${uid}/blog/inline/${Date.now()}-${safe}`;
      const { error } = await supabase.storage.from("venue-uploads").upload(path, file, { upsert: false, contentType: file.type });
      if (error) throw error;
      const { data: signed } = await supabase.storage.from("venue-uploads").createSignedUrl(path, 60 * 60 * 24 * 365);
      if (signed?.signedUrl) editor.chain().focus().setImage({ src: signed.signedUrl }).run();
    } catch (err) { toast.error((err as Error).message); }
    finally { setUploading(false); }
  }

  function onSetLink() {
    if (!editor) return;
    const prev = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("URL do link", prev ?? "https://");
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().unsetLink().run();
    } else {
      editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
    }
  }

  const btn = (active: boolean) => `h-8 px-2 ${active ? "bg-accent text-accent-foreground" : ""}`;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1 rounded-md border border-border bg-card p-1">
        <Button type="button" variant="ghost" size="sm" className={btn(editor.isActive("bold"))} onClick={() => editor.chain().focus().toggleBold().run()}><Bold className="h-4 w-4" /></Button>
        <Button type="button" variant="ghost" size="sm" className={btn(editor.isActive("italic"))} onClick={() => editor.chain().focus().toggleItalic().run()}><Italic className="h-4 w-4" /></Button>
        <Button type="button" variant="ghost" size="sm" className={btn(editor.isActive("heading", { level: 2 }))} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}><Heading2 className="h-4 w-4" /></Button>
        <Button type="button" variant="ghost" size="sm" className={btn(editor.isActive("heading", { level: 3 }))} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}><Heading3 className="h-4 w-4" /></Button>
        <Button type="button" variant="ghost" size="sm" className={btn(editor.isActive("bulletList"))} onClick={() => editor.chain().focus().toggleBulletList().run()}><List className="h-4 w-4" /></Button>
        <Button type="button" variant="ghost" size="sm" className={btn(editor.isActive("orderedList"))} onClick={() => editor.chain().focus().toggleOrderedList().run()}><ListOrdered className="h-4 w-4" /></Button>
        <Button type="button" variant="ghost" size="sm" className={btn(editor.isActive("blockquote"))} onClick={() => editor.chain().focus().toggleBlockquote().run()}><Quote className="h-4 w-4" /></Button>
        <Button type="button" variant="ghost" size="sm" className={btn(editor.isActive("link"))} onClick={onSetLink}><LinkIcon className="h-4 w-4" /></Button>
        <label className="inline-flex">
          <input type="file" accept="image/*" className="hidden" onChange={onPickImage} />
          <Button type="button" variant="ghost" size="sm" className="h-8 px-2" disabled={uploading} asChild>
            <span>{uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />}</span>
          </Button>
        </label>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
