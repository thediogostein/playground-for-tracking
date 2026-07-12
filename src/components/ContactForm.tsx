import { useState, useCallback, useEffect, useRef } from "react";
import { ArrowRight, ArrowLeft, Check, User, Phone, Mail, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface FormData {
  name: string;
  phone: string;
  email: string;
  company: string;
  revenue: string;
}

interface StepDef {
  id: keyof FormData;
  title: string;
  subtitle: string;
  icon: React.ElementType;
  placeholder: string;
  type: "input" | "tel" | "email" | "select";
  options?: { value: string; label: string }[];
}

const REVENUE_OPTIONS = [
  { value: "ate-10k", label: "Até R$ 10 mil" },
  { value: "10k-50k", label: "R$ 10 mil a R$ 50 mil" },
  { value: "50k-200k", label: "R$ 50 mil a R$ 200 mil" },
  { value: "200k-500k", label: "R$ 200 mil a R$ 500 mil" },
  { value: "500k-1m", label: "R$ 500 mil a R$ 1 milhão" },
  { value: "1m-5m", label: "R$ 1 milhão a R$ 5 milhões" },
  { value: "5m-10m", label: "R$ 5 milhões a R$ 10 milhões" },
  { value: "acima-10m", label: "Acima de R$ 10 milhões" },
  { value: "nao-informar", label: "Prefiro não informar" },
];

const STEPS: StepDef[] = [
  {
    id: "name",
    title: "Qual é o seu nome?",
    subtitle: "Nome completo",
    icon: User,
    placeholder: "Digite seu nome completo",
    type: "input",
  },
  {
    id: "phone",
    title: "Qual o seu WhatsApp?",
    subtitle: "Vamos entrar em contato por aqui",
    icon: Phone,
    placeholder: "(11) 99999-9999",
    type: "tel",
  },
  {
    id: "email",
    title: "E o seu melhor e-mail?",
    subtitle: "Para enviarmos materiais e novidades",
    icon: Mail,
    placeholder: "seu@email.com",
    type: "email",
  },
  {
    id: "company",
    title: "Qual o nome da sua empresa?",
    subtitle: "Conte-nos sobre o seu negócio",
    icon: Building2,
    placeholder: "Nome da sua empresa",
    type: "input",
  },
  {
    id: "revenue",
    title: "Qual o faturamento mensal?",
    subtitle: "Para entendermos melhor o seu perfil",
    icon: Building2,
    placeholder: "",
    type: "select",
    options: REVENUE_OPTIONS,
  },
];

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------
function validateField(id: keyof FormData, value: string): string {
  switch (id) {
    case "name":
      if (!value.trim()) return "Nome é obrigatório.";
      if (value.trim().length < 2) return "Mínimo 2 caracteres.";
      if (value.trim().length > 100) return "Máximo 100 caracteres.";
      return "";
    case "phone": {
      const digits = value.replace(/\D/g, "");
      if (digits.length < 10) return "WhatsApp inválido (DDD + número).";
      if (digits.length > 11) return "WhatsApp inválido (DDD + número).";
      return "";
    }
    case "email":
      if (!value.trim()) return "E-mail é obrigatório.";
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) return "E-mail inválido.";
      return "";
    case "company":
      if (!value.trim()) return "Empresa é obrigatória.";
      if (value.trim().length > 150) return "Máximo 150 caracteres.";
      return "";
    case "revenue":
      if (!value) return "Selecione uma opção.";
      return "";
    default:
      return "";
  }
}

// Brazilian phone mask
function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function ContactForm() {
  const [step, setStep] = useState(0);
  const [formData, setFormData] = useState<FormData>({
    name: "",
    phone: "",
    email: "",
    company: "",
    revenue: "",
  });
  const [error, setError] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");

  const currentStep = STEPS[step];
  const isLast = step === STEPS.length - 1;
  const turnstileRef = useRef<HTMLDivElement>(null);
  const turnstileRendered = useRef(false);

  // Render Turnstile widget when reaching the last step
  useEffect(() => {
    if (isLast && turnstileRef.current && !turnstileRendered.current) {
      const tid = setTimeout(() => {
        if ((window as any).turnstile && turnstileRef.current) {
          (window as any).turnstile.render(turnstileRef.current, {
            sitekey: "0x4AAAAAAD0X41y4bQf0QhgW",
            theme: "light",
          });
          turnstileRendered.current = true;
        }
      }, 100);
      return () => clearTimeout(tid);
    }
    // Reset when leaving last step
    if (!isLast) {
      turnstileRendered.current = false;
      if (turnstileRef.current) {
        turnstileRef.current.innerHTML = "";
      }
    }
  }, [isLast]);

  const updateField = useCallback(
    (value: string) => {
      setFormData((prev) => ({
        ...prev,
        [currentStep.id]: currentStep.type === "tel" ? formatPhone(value) : value,
      }));
      setError("");
    },
    [currentStep],
  );

  const handleNext = () => {
    const value = formData[currentStep.id];
    const err = validateField(currentStep.id, value);
    if (err) {
      setError(err);
      return;
    }
    if (isLast) {
      handleSubmit();
    } else {
      setStep((s) => s + 1);
      setError("");
    }
  };

  const handlePrev = () => {
    setStep((s) => s - 1);
    setError("");
  };

  const handleSubmit = async () => {
    // Final validation
    for (const s of STEPS) {
      const err = validateField(s.id, formData[s.id]);
      if (err) {
        setError(err);
        return;
      }
    }

    setStatus("loading");

    (window as any).dataLayer = (window as any).dataLayer || [];
    (window as any).dataLayer.push({
      event: "form_step_submit",
      formId: "contact-form",
      currentStep: STEPS.length,
    });

    // Get Turnstile token
    const turnstileToken = (window as any).turnstile?.getResponse() || "";

    // Prepend +55 for Brazil
    const submitData = {
      ...formData,
      whatsapp: "+55" + formData.phone.replace(/\D/g, ""),
      "cf-turnstile-response": turnstileToken,
    };

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(submitData),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        setStatus("success");
        (window as any).dataLayer.push({
          event: "form_submit_success",
          formId: "contact-form",
          revenue: formData.revenue,
        });
        setTimeout(() => {
          window.location.href = "/obrigado";
        }, 800);
      } else {
        const msg = result.errors
          ? result.errors.map((e: any) => e.message).join("\n")
          : result.error || "Erro ao enviar.";
        setError(msg);
        setStatus("error");
        (window as any).dataLayer.push({
          event: "form_submit_error",
          formId: "contact-form",
          error: result.error || "validation_error",
        });
      }
    } catch {
      setError("Erro de conexão. Verifique sua internet.");
      setStatus("error");
      (window as any).dataLayer.push({
        event: "form_submit_error",
        formId: "contact-form",
        error: "network_error",
      });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleNext();
    }
  };

  const Icon = currentStep.icon;

  return (
    <div className="mx-auto max-w-lg px-4">
      {/* ---- Progress Dots ---- */}
      <div className="mb-8 flex items-center justify-center gap-2">
        {STEPS.map((s, i) => (
          <div key={s.id} className="flex items-center gap-2">
            <div
              className={cn(
                "flex size-8 items-center justify-center rounded-full text-xs font-bold transition-all duration-300",
                i < step && "bg-emerald-500 text-white",
                i === step && "bg-primary text-primary-foreground shadow-md scale-110",
                i > step && "bg-muted text-muted-foreground",
              )}
            >
              {i < step ? <Check className="size-4" /> : i + 1}
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={cn(
                  "h-0.5 w-6 rounded transition-colors duration-300",
                  i < step ? "bg-emerald-500" : "bg-muted",
                )}
              />
            )}
          </div>
        ))}
      </div>

      {/* ---- Card ---- */}
      <Card className="border-0 shadow-xl shadow-primary/5">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto mb-3 flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Icon className="size-6" />
          </div>
          <CardTitle className="text-xl">{currentStep.title}</CardTitle>
          <CardDescription className="text-sm">{currentStep.subtitle}</CardDescription>
        </CardHeader>

        <CardContent className="px-8 pb-4">
          {status === "success" ? (
            <div className="flex flex-col items-center gap-3 py-8 text-center animate-in fade-in zoom-in-95">
              <div className="flex size-16 items-center justify-center rounded-full bg-emerald-100">
                <Check className="size-8 text-emerald-600" />
              </div>
              <p className="text-lg font-semibold text-emerald-700">Tudo pronto!</p>
              <p className="text-sm text-muted-foreground">Redirecionando...</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2" onKeyDown={handleKeyDown}>
              <Label htmlFor={currentStep.id} className="sr-only">
                {currentStep.title}
              </Label>

              {currentStep.type === "select" ? (
                <Select
                  value={formData.revenue}
                  onValueChange={(v) => updateField(v)}
                >
                  <SelectTrigger id="revenue" className="h-12 text-base">
                    <SelectValue placeholder="Selecione a faixa de faturamento" />
                  </SelectTrigger>
                  <SelectContent>
                    {REVENUE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  id={currentStep.id}
                  type={currentStep.type === "tel" ? "tel" : currentStep.type === "email" ? "email" : "text"}
                  placeholder={currentStep.placeholder}
                  value={formData[currentStep.id] as string}
                  onChange={(e) => updateField(e.target.value)}
                  autoFocus
                  inputMode={currentStep.type === "tel" ? "numeric" : undefined}
                  className="text-center text-lg"
                  autoComplete={
                    currentStep.id === "name"
                      ? "name"
                      : currentStep.id === "email"
                        ? "email"
                        : currentStep.id === "phone"
                          ? "tel"
                          : "organization"
                  }
                />
              )}

              {error && (
                <p className="text-sm text-destructive text-center animate-in slide-in-from-top-2">
                  {error}
                </p>
              )}

              {/* Turnstile widget on last step */}
              {isLast && status !== "success" && (
                <div ref={turnstileRef} className="mt-3 flex justify-center" />
              )}
            </div>
          )}
        </CardContent>

        <CardFooter className="flex justify-between px-8 pb-6">
          {step > 0 && status !== "success" ? (
            <Button variant="ghost" onClick={handlePrev} disabled={status === "loading"}>
              <ArrowLeft className="size-4" />
              Voltar
            </Button>
          ) : (
            <div />
          )}

          {status !== "success" && (
            <Button
              onClick={handleNext}
              disabled={status === "loading"}
              className="min-w-32"
            >
              {status === "loading" ? (
                <>
                  <span className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Enviando...
                </>
              ) : isLast ? (
                <>
                  Enviar
                  <ArrowRight className="size-4" />
                </>
              ) : (
                <>
                  Próximo
                  <ArrowRight className="size-4" />
                </>
              )}
            </Button>
          )}
        </CardFooter>
      </Card>

      {/* ---- Step counter ---- */}
      <p className="mt-4 text-center text-xs text-muted-foreground">
        Passo {step + 1} de {STEPS.length}
      </p>
    </div>
  );
}
