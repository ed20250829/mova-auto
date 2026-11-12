type Props = {
  price?: string;
};

export default function PaymentStub({ price }: Props) {
  const amount = price ? `${price} BYN` : 'сумма из заявки';

  return (
    <div className="surface payment-stub">
      <p className="kicker" style={{ margin: 0 }}>
        Оплата
      </p>
      <h2 className="display" style={{ fontSize: '1.35rem', margin: '0.35rem 0 0.5rem' }}>
        Онлайн-оплата подключается
      </h2>
      <p className="muted" style={{ margin: '0 0 1rem' }}>
        Пока принимаем перевод, ЕРИП/E-POS по ссылке от мастера или оплату на месте. К оплате {amount}.
      </p>
      <div className="payment-stub-methods" role="group" aria-label="Способы оплаты (скоро)">
        <button type="button" className="btn btn-ghost" disabled title="bePaid / КРОК — позже">
          КРОК
        </button>
        <button type="button" className="btn btn-ghost" disabled title="Карты — позже">
          Карта
        </button>
        <button type="button" className="btn btn-ghost" disabled title="ЕРИП — позже">
          ЕРИП
        </button>
      </div>
      <p className="muted" style={{ margin: '0.85rem 0 0', fontSize: '0.82rem' }}>
        Provider later: bePaid widget + webhook. Сейчас статус оплаты ставит админ вручную.
      </p>
    </div>
  );
}
