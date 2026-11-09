type Props = {
  price: number;
  modelLabel?: string;
};

export default function ShareButton({ price, modelLabel }: Props) {
  async function share() {
    const text = `Моя русификация${modelLabel ? ` (${modelLabel})` : ''} стоит ${price} BYN. А у тебя? mova-auto.tech`;
    void fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'share_click', meta: { price, modelLabel } }),
    });

    if (navigator.share) {
      try {
        await navigator.share({ title: 'Мова', text, url: 'https://mova-auto.tech' });
        return;
      } catch {
        /* user cancelled */
      }
    }
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* ignore */
    }
  }

  return (
    <button type="button" className="btn btn-ghost" onClick={share} style={{ minHeight: 40 }}>
      Поделиться
    </button>
  );
}
