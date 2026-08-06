import { useEffect, useId, useRef, useState } from 'react';

/**
 * The only JavaScript on the site. Everything else is static HTML.
 *
 * All copy and limits arrive as props from site.config.ts — nothing
 * client-specific is written in here.
 */

export interface ContactFormProps {
  services: { slug: string; title: string }[];
  /** Worker URL. Empty string means the backend is not deployed yet. */
  endpoint: string;
  maxUploadMB: number;
  acceptedFileTypes: string[];
  /** Empty string hides the Turnstile widget. */
  turnstileSiteKey: string;
}

type Status =
  | { kind: 'idle' }
  | { kind: 'submitting' }
  | { kind: 'success' }
  | { kind: 'error'; message: string };

/**
 * `| undefined` on every member is required by `exactOptionalPropertyTypes`:
 * clearing a field error assigns `undefined` rather than deleting the key.
 */
interface FieldErrors {
  name?: string | undefined;
  phone?: string | undefined;
  email?: string | undefined;
  message?: string | undefined;
  file?: string | undefined;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** At least 10 digits, ignoring spaces, dashes, dots and parens. */
const digits = (s: string) => s.replace(/\D/g, '');

function extensionsFor(mimeTypes: string[]): string {
  const map: Record<string, string> = {
    'image/jpeg': 'JPG',
    'image/png': 'PNG',
    'image/heic': 'HEIC',
    'image/webp': 'WEBP',
    'application/pdf': 'PDF',
  };
  return mimeTypes.map((t) => map[t] ?? t).join(', ');
}

export default function ContactForm({
  services,
  endpoint,
  maxUploadMB,
  acceptedFileTypes,
  turnstileSiteKey,
}: ContactFormProps) {
  const uid = useId();
  const id = (name: string) => `${uid}-${name}`;

  const formRef = useRef<HTMLFormElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Object URLs are revoked whenever the selection changes and on unmount, so
  // repeatedly picking files cannot leak memory.
  useEffect(() => {
    if (!file || !file.type.startsWith('image/')) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const maxBytes = maxUploadMB * 1024 * 1024;

  function validateFile(candidate: File): string | undefined {
    if (candidate.size > maxBytes) {
      return `That file is ${(candidate.size / 1024 / 1024).toFixed(1)} MB. The limit is ${maxUploadMB} MB — try a smaller photo.`;
    }
    if (acceptedFileTypes.length > 0 && !acceptedFileTypes.includes(candidate.type)) {
      return `We can't read that file type. Accepted: ${extensionsFor(acceptedFileTypes)}.`;
    }
    return undefined;
  }

  function onFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const candidate = event.target.files?.[0] ?? null;
    if (!candidate) {
      setFile(null);
      setErrors((prev) => ({ ...prev, file: undefined }));
      return;
    }
    const error = validateFile(candidate);
    if (error) {
      setFile(null);
      event.target.value = '';
      setErrors((prev) => ({ ...prev, file: error }));
      return;
    }
    setFile(candidate);
    setErrors((prev) => ({ ...prev, file: undefined }));
  }

  function clearFile() {
    setFile(null);
    setErrors((prev) => ({ ...prev, file: undefined }));
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function validate(data: FormData): FieldErrors {
    const next: FieldErrors = {};
    const name = String(data.get('name') ?? '').trim();
    const phone = String(data.get('phone') ?? '').trim();
    const email = String(data.get('email') ?? '').trim();
    const message = String(data.get('message') ?? '').trim();

    if (name.length < 2) next.name = 'Please tell us your name.';
    if (!phone && !email) {
      next.phone = 'We need a phone number or an email address so we can reply.';
      next.email = 'We need a phone number or an email address so we can reply.';
    } else {
      if (phone && digits(phone).length < 10) next.phone = 'That phone number looks too short.';
      if (email && !EMAIL_RE.test(email)) next.email = 'That email address does not look right.';
    }
    if (message.trim().length < 10) {
      next.message = 'A sentence or two about the part or the job, please.';
    }
    if (file) {
      const fileError = validateFile(file);
      if (fileError) next.file = fileError;
    }
    return next;
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);

    const found = validate(data);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      setStatus({ kind: 'idle' });
      // Move focus to the first field with a problem.
      const firstKey = Object.keys(found)[0];
      if (firstKey) form.querySelector<HTMLElement>(`[name="${firstKey}"]`)?.focus();
      return;
    }

    if (!endpoint) {
      setStatus({
        kind: 'error',
        message:
          'The form backend is not connected yet on this preview build. Please call or email us instead — details are just above.',
      });
      return;
    }

    setStatus({ kind: 'submitting' });
    try {
      const response = await fetch(endpoint, { method: 'POST', body: data });
      if (!response.ok) throw new Error(`Server responded ${response.status}`);
      setStatus({ kind: 'success' });
      form.reset();
      clearFile();
    } catch {
      setStatus({
        kind: 'error',
        message:
          'Something went wrong sending that. Please try again, or call the shop directly — the number is just above.',
      });
    }
  }

  const busy = status.kind === 'submitting';

  const describedBy = (field: keyof FieldErrors, ...extra: string[]) =>
    [...extra, errors[field] ? id(`${field}-error`) : null].filter(Boolean).join(' ') || undefined;

  const fieldClass = (field: keyof FieldErrors) =>
    [
      'w-full rounded-md border bg-white px-4 py-3 text-base text-slate-900 placeholder:text-slate-400',
      errors[field] ? 'border-red-600' : 'border-slate-300',
    ].join(' ');

  if (status.kind === 'success') {
    return (
      <div
        role="status"
        className="rounded-lg border-2 border-primary bg-primary-wash p-6 sm:p-8"
        aria-live="polite"
      >
        <h3 className="font-heading text-2xl font-bold text-slate-900">Thanks — that's with us.</h3>
        <p className="mt-3 text-base leading-relaxed text-slate-700">
          We read everything that comes in and reply during shop hours, usually the same day. If it
          is urgent, calling is always faster.
        </p>
        <button
          type="button"
          className="btn-outline mt-6"
          onClick={() => setStatus({ kind: 'idle' })}
        >
          Send another
        </button>
      </div>
    );
  }

  return (
    <form
      ref={formRef}
      onSubmit={onSubmit}
      noValidate
      encType="multipart/form-data"
      className="space-y-5"
    >
      {/* Honeypot. Hidden from people and from screen readers; bots fill it in
          and the Worker drops the submission. */}
      <div className="hidden" aria-hidden="true">
        <label htmlFor={id('company')}>Company (leave this empty)</label>
        <input id={id('company')} type="text" name="company" tabIndex={-1} autoComplete="off" />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor={id('name')} className="block text-sm font-bold text-slate-900">
            Your name <span className="text-red-700">*</span>
          </label>
          <input
            id={id('name')}
            name="name"
            type="text"
            autoComplete="name"
            required
            aria-invalid={errors.name ? true : undefined}
            aria-describedby={describedBy('name')}
            className={`mt-2 ${fieldClass('name')}`}
          />
          {errors.name && (
            <p id={id('name-error')} className="mt-2 text-sm font-semibold text-red-700">
              {errors.name}
            </p>
          )}
        </div>

        <div>
          <label htmlFor={id('phone')} className="block text-sm font-bold text-slate-900">
            Phone
          </label>
          <input
            id={id('phone')}
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            aria-invalid={errors.phone ? true : undefined}
            aria-describedby={describedBy('phone', id('contact-hint'))}
            className={`mt-2 ${fieldClass('phone')}`}
          />
          {errors.phone && (
            <p id={id('phone-error')} className="mt-2 text-sm font-semibold text-red-700">
              {errors.phone}
            </p>
          )}
        </div>
      </div>

      <div>
        <label htmlFor={id('email')} className="block text-sm font-bold text-slate-900">
          Email
        </label>
        <input
          id={id('email')}
          name="email"
          type="email"
          autoComplete="email"
          aria-invalid={errors.email ? true : undefined}
          aria-describedby={describedBy('email', id('contact-hint'))}
          className={`mt-2 ${fieldClass('email')}`}
        />
        <p id={id('contact-hint')} className="mt-2 text-sm text-slate-600">
          A phone number or an email address — whichever you'd rather we used.
        </p>
        {errors.email && (
          <p id={id('email-error')} className="mt-2 text-sm font-semibold text-red-700">
            {errors.email}
          </p>
        )}
      </div>

      <div>
        <label htmlFor={id('service')} className="block text-sm font-bold text-slate-900">
          What do you need?
        </label>
        <select
          id={id('service')}
          name="service"
          defaultValue=""
          className="mt-2 w-full rounded-md border border-slate-300 bg-white px-4 py-3 text-base text-slate-900"
        >
          <option value="">Not sure / something else</option>
          {services.map((service) => (
            <option key={service.slug} value={service.slug}>
              {service.title}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor={id('message')} className="block text-sm font-bold text-slate-900">
          About the job <span className="text-red-700">*</span>
        </label>
        <textarea
          id={id('message')}
          name="message"
          rows={5}
          required
          placeholder="What the part is, what went wrong, what it goes in, and when you need it."
          aria-invalid={errors.message ? true : undefined}
          aria-describedby={describedBy('message')}
          className={`mt-2 ${fieldClass('message')}`}
        />
        {errors.message && (
          <p id={id('message-error')} className="mt-2 text-sm font-semibold text-red-700">
            {errors.message}
          </p>
        )}
      </div>

      <div>
        <label htmlFor={id('file')} className="block text-sm font-bold text-slate-900">
          Photo of your part
        </label>
        <p id={id('file-hint')} className="mt-1 text-sm text-slate-600">
          Optional, and it helps more than anything else you can tell us. Up to {maxUploadMB} MB.{' '}
          {extensionsFor(acceptedFileTypes)}.
        </p>
        <input
          ref={fileInputRef}
          id={id('file')}
          name="file"
          type="file"
          accept={acceptedFileTypes.join(',')}
          onChange={onFileChange}
          aria-invalid={errors.file ? true : undefined}
          aria-describedby={describedBy('file', id('file-hint'))}
          className="mt-2 block w-full cursor-pointer rounded-md border border-slate-300 bg-white text-sm text-slate-700 file:mr-4 file:cursor-pointer file:border-0 file:bg-slate-100 file:px-4 file:py-3 file:text-sm file:font-bold file:text-slate-800 hover:file:bg-slate-200"
        />
        {errors.file && (
          <p id={id('file-error')} className="mt-2 text-sm font-semibold text-red-700">
            {errors.file}
          </p>
        )}
        {file && (
          <div className="mt-3 flex items-center gap-4 rounded-md border border-slate-200 bg-slate-50 p-3">
            {previewUrl ? (
              <img
                src={previewUrl}
                alt={`Preview of ${file.name}`}
                className="h-16 w-16 rounded object-cover"
              />
            ) : (
              <span className="flex h-16 w-16 items-center justify-center rounded bg-slate-200 text-xs font-bold text-slate-600">
                PDF
              </span>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-slate-800">{file.name}</p>
              <p className="text-xs text-slate-600">{(file.size / 1024 / 1024).toFixed(1)} MB</p>
            </div>
            <button
              type="button"
              onClick={clearFile}
              className="shrink-0 rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-white"
            >
              Remove
            </button>
          </div>
        )}
      </div>

      {/* Cloudflare Turnstile mounts here when a site key is configured. The
          widget script is only loaded when there is a key, so the default
          build makes no third-party request at all. */}
      {turnstileSiteKey ? (
        <div
          className="cf-turnstile"
          data-sitekey={turnstileSiteKey}
          data-theme="light"
          data-action="contact"
        />
      ) : null}

      <div aria-live="polite" aria-atomic="true">
        {status.kind === 'error' && (
          <p
            role="alert"
            className="rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800"
          >
            {status.message}
          </p>
        )}
        {busy && <p className="text-sm font-semibold text-slate-700">Sending…</p>}
      </div>

      <button type="submit" className="btn-primary w-full sm:w-auto" disabled={busy}>
        {busy ? 'Sending…' : 'Send it over'}
      </button>

      <p className="text-sm text-slate-600">
        We use what you send here to reply to you about the job, and nothing else.
      </p>
    </form>
  );
}
