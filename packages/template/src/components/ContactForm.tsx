import { useEffect, useId, useRef, useState } from 'react';
import { contactMode, type ResolvedFields } from '../lib/form-fields';

/**
 * The only JavaScript on the site. Everything else is static HTML.
 *
 * All copy and limits arrive as props from site.config.ts — nothing
 * client-specific is written in here.
 *
 * Two things vary per client now. **Which fields exist** comes from
 * `forms.fields`, resolved by `src/lib/form-fields.ts` and mirrored by the
 * Worker, so a shop that only ever calls people can stop collecting email
 * addresses. **How it is laid out** is `layout`: the full contact-page form, or
 * the compact quote block that sits on the home page and in the CTA band. The
 * compact one is this component with a narrower field set, not a second
 * component — a quick form that validated differently from the real one would
 * be found by a customer rather than by a build.
 */

export interface ContactFormProps {
  /**
   * `worker` posts to `endpoint`; `mailto` composes a message to `mailto`
   * instead. The page does not render this component at all when the config
   * says `disabled`, so that case never reaches here.
   */
  mode: 'worker' | 'mailto';
  /** Inbox for `mode: 'mailto'`. Ignored in `worker` mode. */
  mailto: string;
  services: { slug: string; title: string }[];
  /** Worker URL. Empty string means the backend is not deployed yet. */
  endpoint: string;
  /**
   * Which prospect's demo this is, sent with the submission so the shared demo
   * Worker can tag the email. Empty on a real client build, where the endpoint
   * belongs to that client alone and there is nothing to disambiguate.
   */
  prospectId?: string;
  /** The business name, sent alongside `prospectId` so the notification email
   *  reads as a shop rather than as a slug. Empty when `prospectId` is. */
  prospectName?: string;
  /** The shop's number, shown in the success and offline states so a visitor
   *  in a hurry has somewhere to go without scrolling back up. */
  phone: string;
  maxUploadMB: number;
  acceptedFileTypes: string[];
  /** Empty string hides the Turnstile widget. */
  turnstileSiteKey: string;
  /** Resolved per-client field rules. See `src/lib/form-fields.ts`. */
  fields: ResolvedFields;
  /** `compact` is the quote block: fewer fields, one column, no headings. */
  layout?: 'full' | 'compact';
  /** Submit button label. The compact block passes its own. */
  submitLabel?: string;
}

type Status =
  | { kind: 'idle' }
  | { kind: 'submitting' }
  | { kind: 'success'; note?: string | undefined }
  /**
   * Separate from `error` on purpose. "No signal" is not a failure of the
   * form and the visitor can fix it by walking outside; saying "something went
   * wrong" would send them looking for a problem that is not there.
   */
  | { kind: 'offline' }
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
    'model/step': 'STEP',
    'application/dxf': 'DXF',
  };
  return mimeTypes.map((t) => map[t] ?? t).join(', ');
}

export default function ContactForm({
  mode,
  mailto,
  services,
  endpoint,
  prospectId = '',
  prospectName = '',
  phone,
  maxUploadMB,
  acceptedFileTypes,
  turnstileSiteKey,
  fields,
  layout = 'full',
  submitLabel,
}: ContactFormProps) {
  const uid = useId();
  const id = (name: string) => `${uid}-${name}`;

  const formRef = useRef<HTMLFormElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const compact = layout === 'compact';
  const shows = (field: keyof ResolvedFields) => fields[field] !== 'hidden';
  const requires = (field: keyof ResolvedFields) => fields[field] === 'required';
  const eitherContact = contactMode(fields) === 'either';

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

  /**
   * The same rules the Worker will apply, in the same order — see
   * `worker-demo/src/lib/validate.ts`. A field this client does not render is
   * not judged here at all.
   */
  function validate(data: FormData): FieldErrors {
    const next: FieldErrors = {};
    const name = String(data.get('name') ?? '').trim();
    const phoneValue = String(data.get('phone') ?? '').trim();
    const email = String(data.get('email') ?? '').trim();
    const message = String(data.get('message') ?? '').trim();

    if (shows('name')) {
      if (requires('name') && name.length < 2) next.name = 'Please tell us your name.';
      else if (name && name.length < 2) next.name = 'Please tell us your name.';
    }

    if (eitherContact) {
      if (!phoneValue && !email) {
        const both = 'We need a phone number or an email address so we can reply.';
        next.phone = both;
        next.email = both;
      }
    } else {
      if (requires('phone') && !phoneValue) {
        next.phone = 'We need a phone number so we can call you back.';
      }
      if (requires('email') && !email) {
        next.email = 'We need an email address so we can reply.';
      }
    }
    if (shows('phone') && phoneValue && digits(phoneValue).length < 10) {
      next.phone = 'That phone number looks too short.';
    }
    if (shows('email') && email && !EMAIL_RE.test(email)) {
      next.email = 'That email address does not look right.';
    }

    if (shows('message') && requires('message') && message.length < 10) {
      next.message = 'A sentence or two about the part or the job, please.';
    }

    if (shows('file')) {
      if (requires('file') && !file) next.file = 'Please attach a photo of the part.';
      else if (file) {
        const fileError = validateFile(file);
        if (fileError) next.file = fileError;
      }
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

    // No backend: hand the message to the visitor's mail client. The file
    // cannot ride along on a mailto:, so we say so rather than dropping it
    // silently — the visitor can attach it themselves.
    if (mode === 'mailto') {
      const lines = [
        `Name: ${String(data.get('name') ?? '')}`,
        `Phone: ${String(data.get('phone') ?? '')}`,
        `Email: ${String(data.get('email') ?? '')}`,
        `Service: ${String(data.get('service') ?? '')}`,
        '',
        String(data.get('message') ?? ''),
        ...(file ? ['', `(Attachment to add manually: ${file.name})`] : []),
      ];
      window.location.href =
        `mailto:${mailto}` +
        `?subject=${encodeURIComponent('Website enquiry')}` +
        `&body=${encodeURIComponent(lines.join('\n'))}`;
      setStatus({
        kind: 'success',
        ...(file ? { note: 'Add your photo as an attachment before sending.' } : {}),
      });
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

    // A page served from the service worker's cache looks completely normal
    // with no connection at all, which is the point — but a form POST is the
    // one thing that cannot work offline. Say so before the request, rather
    // than letting a fetch hang and then reporting a generic failure.
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      setStatus({ kind: 'offline' });
      return;
    }

    // Which prospect's demo this came from. The shared Worker tags the email
    // with it; on a real client build it is empty and the Worker never sees it.
    if (prospectId) {
      data.set('prospectId', prospectId);
      if (prospectName) data.set('prospectName', prospectName);
    }

    setStatus({ kind: 'submitting' });
    try {
      const response = await fetch(endpoint, { method: 'POST', body: data });
      if (!response.ok) throw new Error(`Server responded ${response.status}`);
      setStatus({ kind: 'success' });
      form.reset();
      clearFile();
    } catch {
      // A thrown fetch with the connection gone between the check above and
      // here is still an offline case, not a server fault.
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        setStatus({ kind: 'offline' });
        return;
      }
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

  /**
   * The `*` and the space before it, together.
   *
   * Together on purpose: written as `Phone {mark}` in the label, an optional
   * field would still emit a trailing space and every existing client's built
   * HTML would move by one byte for no reason. The space belongs to the mark.
   */
  const requiredMark = (field: keyof ResolvedFields) =>
    requires(field) ? (
      <>
        {' '}
        <span className="text-red-700">*</span>
      </>
    ) : null;

  const errorFor = (field: keyof FieldErrors) =>
    errors[field] ? (
      <p id={id(`${field}-error`)} className="form-error mt-2 text-sm font-semibold text-red-700">
        {errors[field]}
      </p>
    ) : null;

  if (status.kind === 'offline') {
    return (
      <div
        role="status"
        aria-live="polite"
        className="form-status rounded-lg border-2 border-amber-500 bg-amber-50 p-6 sm:p-8"
      >
        <h3 className="font-heading text-2xl font-bold text-slate-900">No signal right now.</h3>
        <p className="mt-3 text-base leading-relaxed text-slate-800">
          Your message hasn't been sent — the phone has no connection. Nothing you typed is lost;
          try again once you have a bar or two.
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <button type="button" className="btn-outline" onClick={() => setStatus({ kind: 'idle' })}>
            Back to the form
          </button>
          <a className="btn-primary" href={`tel:${phone.replace(/[^\d+]/g, '')}`}>
            Call {phone}
          </a>
        </div>
      </div>
    );
  }

  if (status.kind === 'success') {
    /*
     * The animation is decoration layered over a state that is already
     * announced: `role="status"` + `aria-live` do the work for a screen
     * reader, and every keyframe below is suppressed by the global
     * `prefers-reduced-motion` block in global.css, which leaves the finished
     * state on screen because each animation uses `forwards`.
     */
    return (
      <div
        role="status"
        aria-live="polite"
        className={`form-status success-card rounded-lg border-2 border-primary bg-primary-wash text-center ${
          compact ? 'p-5' : 'p-6 sm:p-8'
        }`}
      >
        <span
          className={`success-ring mx-auto flex items-center justify-center rounded-full bg-primary/10 ${
            compact ? 'h-14 w-14' : 'h-20 w-20'
          }`}
        >
          <svg
            className={compact ? 'h-8 w-8' : 'h-12 w-12'}
            viewBox="0 0 52 52"
            fill="none"
            stroke="currentColor"
            strokeWidth={3.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle className="success-ring-circle text-primary" cx="26" cy="26" r="24" />
            <path className="success-ring-check text-primary" d="M15 27.5 22.5 35 37 19" />
          </svg>
        </span>

        <h3
          className={`success-line success-line-1 mt-5 font-heading font-bold text-slate-900 ${
            compact ? 'text-xl' : 'text-2xl'
          }`}
        >
          Thanks — that's with us.
        </h3>
        <p className="success-line success-line-2 mx-auto mt-3 max-w-prose text-base leading-relaxed text-slate-700">
          We read everything that comes in and reply during shop hours, usually the same day. If it
          is urgent, calling is always faster.
        </p>
        {status.note && (
          <p className="success-line success-line-2 mt-3 text-base font-semibold leading-relaxed text-slate-900">
            {status.note}
          </p>
        )}
        <div className="success-line success-line-3 mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <a className="btn-primary" href={`tel:${phone.replace(/[^\d+]/g, '')}`}>
            Call {phone}
          </a>
          <button type="button" className="btn-outline" onClick={() => setStatus({ kind: 'idle' })}>
            Send another
          </button>
        </div>
      </div>
    );
  }

  return (
    <form
      ref={formRef}
      onSubmit={onSubmit}
      noValidate
      encType="multipart/form-data"
      className={compact ? 'space-y-4' : 'space-y-5'}
    >
      {!compact && (
        <p className="text-base text-slate-600">
          Fields marked <span className="font-bold text-red-700">*</span> are required.
        </p>
      )}

      {/* Honeypot. Hidden from people and from screen readers; bots fill it in
          and the Worker drops the submission.

          The native `hidden` attribute as well as the utility class, because
          the utility class is Tailwind's and a design-family page does not load
          Tailwind — on those pages the class alone left the honeypot on screen,
          asking a real customer for their company and then throwing their
          message away when they answered. */}
      <div hidden className="hidden" aria-hidden="true">
        <label htmlFor={id('company')}>Company (leave this empty)</label>
        <input id={id('company')} type="text" name="company" tabIndex={-1} autoComplete="off" />
      </div>

      <div className={compact ? 'grid gap-4 sm:grid-cols-2' : 'grid gap-5 sm:grid-cols-2'}>
        {shows('name') && (
          <div>
            <label htmlFor={id('name')} className="block text-sm font-bold text-slate-900">
              Your name{requiredMark('name')}
            </label>
            <input
              id={id('name')}
              name="name"
              type="text"
              autoComplete="name"
              required={requires('name')}
              aria-invalid={errors.name ? true : undefined}
              aria-describedby={describedBy('name')}
              className={`mt-2 ${fieldClass('name')}`}
            />
            {errorFor('name')}
          </div>
        )}

        {shows('phone') && (
          <div>
            <label htmlFor={id('phone')} className="block text-sm font-bold text-slate-900">
              Phone{requiredMark('phone')}
            </label>
            <input
              id={id('phone')}
              name="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              required={requires('phone')}
              aria-invalid={errors.phone ? true : undefined}
              aria-describedby={describedBy(
                'phone',
                ...(eitherContact && shows('email') ? [id('contact-hint')] : []),
              )}
              className={`mt-2 ${fieldClass('phone')}`}
            />
            {errorFor('phone')}
          </div>
        )}
      </div>

      {shows('email') && (
        <div>
          <label htmlFor={id('email')} className="block text-sm font-bold text-slate-900">
            Email{requiredMark('email')}
          </label>
          <input
            id={id('email')}
            name="email"
            type="email"
            autoComplete="email"
            required={requires('email')}
            aria-invalid={errors.email ? true : undefined}
            aria-describedby={describedBy(
              'email',
              ...(eitherContact && shows('phone') ? [id('contact-hint')] : []),
            )}
            className={`mt-2 ${fieldClass('email')}`}
          />
          {/* The either/or hint only makes sense when both fields are on the
              page and neither is compulsory on its own. */}
          {eitherContact && shows('phone') && (
            <p id={id('contact-hint')} className="mt-2 text-sm text-slate-600">
              A phone number or an email address — whichever you'd rather we used.
            </p>
          )}
          {errorFor('email')}
        </div>
      )}

      {shows('service') && (
        <div>
          <label htmlFor={id('service')} className="block text-sm font-bold text-slate-900">
            What do you need?{requiredMark('service')}
          </label>
          <select
            id={id('service')}
            name="service"
            defaultValue=""
            required={requires('service')}
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
      )}

      {shows('message') && (
        <div>
          <label htmlFor={id('message')} className="block text-sm font-bold text-slate-900">
            {compact ? 'What do you need?' : 'About the job'}{requiredMark('message')}
          </label>
          <textarea
            id={id('message')}
            name="message"
            rows={compact ? 2 : 5}
            required={requires('message')}
            placeholder={
              compact
                ? 'One line is plenty — what the job is.'
                : 'What the part is, what went wrong, what it goes in, and when you need it.'
            }
            aria-invalid={errors.message ? true : undefined}
            aria-describedby={describedBy('message')}
            className={`mt-2 ${fieldClass('message')}`}
          />
          {errorFor('message')}
        </div>
      )}

      {shows('file') && (
        <div>
          <label htmlFor={id('file')} className="block text-sm font-bold text-slate-900">
            Photo of your part{requiredMark('file')}
          </label>
          <p id={id('file-hint')} className="mt-1 text-sm text-slate-600">
            {requires('file') ? 'Required, and it' : 'Optional, and it'} helps more than anything
            else you can tell us. Up to {maxUploadMB} MB. {extensionsFor(acceptedFileTypes)}.
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
          {errorFor('file')}
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
      )}

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
        {busy ? 'Sending…' : (submitLabel ?? 'Send it over')}
      </button>

      <p className="text-sm text-slate-600">
        We use what you send here to reply to you about the job, and nothing else.
      </p>
    </form>
  );
}
