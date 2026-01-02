import { getQuotes } from "@/lib/quotes";
import QuotesListPage from "../components/quotes/QuotesListPage";
import { createQuote } from "../actions/quotes";

export default async function QuotesPage() {
  const quotes = await getQuotes();

  return <QuotesListPage initialQuotes={quotes} createQuote={createQuote} />;
}