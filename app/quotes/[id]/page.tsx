import { getQuoteWithItems } from "@/lib/quotes";
import QuoteDetailPage from "../../components/quotes/QuoteDetailPage";
import {
  updateQuote,
  deleteQuote,
  addQuoteItem,
  updateQuoteItem,
  deleteQuoteItem,
} from "../../actions/quotes";
import { notFound } from "next/navigation";

export default async function QuoteDetailPageRoute({
  params,
}: {
  params: Promise<{ id: string }> | { id: string };
}) {
  const resolvedParams = await Promise.resolve(params);
  const quoteId = resolvedParams.id;

  if (!quoteId) {
    notFound();
  }

  const quote = await getQuoteWithItems(quoteId);

  if (!quote) {
    notFound();
  }

  return (
    <QuoteDetailPage
      initialQuote={quote}
      updateQuote={updateQuote}
      deleteQuote={deleteQuote}
      addQuoteItem={addQuoteItem}
      updateQuoteItem={updateQuoteItem}
      deleteQuoteItem={deleteQuoteItem}
    />
  );
}