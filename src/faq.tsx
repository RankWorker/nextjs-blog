/**
 * Client entry point for the built-in interactive FAQ component.
 *
 * The build restores the `"use client"` directive after bundling because
 * esbuild removes module directives from bundled files. This keeps the
 * accordion on the client while article pages remain Server Components.
 */
export { FAQ, type FAQItem, type FAQProps } from "./ui/faq.js";
