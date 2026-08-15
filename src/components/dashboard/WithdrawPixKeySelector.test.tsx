import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { WithdrawPixKeySelector } from "@/components/dashboard/WithdrawPixKeySelector";
import { resolveSelectedPixKey, parseAffiliatePixKeys } from "@/lib/affiliatePixKeys";

const CPF = { type: "CPF", value: "12345678901" };
const EMAIL = { type: "E-mail", value: "afiliado@velo.com.br" };

/** Espelha o que a CommissionsPage faz: a seleção efetiva vem da regra pura. */
const renderSelector = (pixKeys: Array<{ type: string; value: string }>, current: string | null = null) => {
  const onSelect = vi.fn();
  const onRegisterPixKey = vi.fn();
  render(
    <WithdrawPixKeySelector
      pixKeys={pixKeys}
      loading={false}
      selectedValue={resolveSelectedPixKey(pixKeys, current)?.value ?? null}
      onSelect={onSelect}
      onRegisterPixKey={onRegisterPixKey}
    />,
  );
  return { onSelect, onRegisterPixKey };
};

describe("WithdrawPixKeySelector", () => {
  it("pré-seleciona a chave quando o afiliado só tem uma cadastrada", () => {
    renderSelector([CPF]);

    expect(screen.getByRole("radio")).toBeChecked();
    expect(screen.getByText("12345678901")).toBeInTheDocument();
    expect(screen.getByText("Chave cadastrada no seu perfil de afiliado.")).toBeInTheDocument();
  });

  it("não escolhe por conta própria quando há mais de uma chave", () => {
    renderSelector([CPF, EMAIL]);

    for (const radio of screen.getAllByRole("radio")) {
      expect(radio).not.toBeChecked();
    }
    expect(screen.getByText("Escolha qual das suas chaves cadastradas vai receber este saque.")).toBeInTheDocument();
  });

  it("deixa o afiliado escolher entre as chaves cadastradas", () => {
    const { onSelect } = renderSelector([CPF, EMAIL]);

    fireEvent.click(screen.getByRole("radio", { name: /afiliado@velo\.com\.br/i }));

    expect(onSelect).toHaveBeenCalledWith(EMAIL.value);
  });

  it("marca a chave escolhida entre várias", () => {
    renderSelector([CPF, EMAIL], EMAIL.value);

    expect(screen.getByRole("radio", { name: /afiliado@velo\.com\.br/i })).toBeChecked();
    expect(screen.getByRole("radio", { name: /12345678901/i })).not.toBeChecked();
  });

  it("sem chave cadastrada, oferece o caminho para o formulário de afiliado", () => {
    const { onRegisterPixKey } = renderSelector([]);

    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
    expect(
      screen.getByText("Cadastre uma chave Pix no seu perfil de afiliado pra poder sacar."),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /cadastrar chave pix/i }));
    expect(onRegisterPixKey).toHaveBeenCalledTimes(1);
  });
});

describe("resolveSelectedPixKey", () => {
  it("não seleciona nada sem chaves cadastradas — o saque fica bloqueado", () => {
    expect(resolveSelectedPixKey([], null)).toBeNull();
    expect(resolveSelectedPixKey([], "12345678901")).toBeNull();
  });

  it("mantém a escolha do afiliado enquanto a chave existir", () => {
    expect(resolveSelectedPixKey([CPF, EMAIL], EMAIL.value)).toEqual(EMAIL);
  });

  it("descarta a escolha quando a chave sai do cadastro", () => {
    expect(resolveSelectedPixKey([CPF, EMAIL], "chave-removida")).toBeNull();
  });

  it("com uma única chave, a chave removida cai de volta na que sobrou", () => {
    expect(resolveSelectedPixKey([CPF], "chave-removida")).toEqual(CPF);
  });
});

describe("parseAffiliatePixKeys", () => {
  it("descarta entradas sem valor e apara espaços", () => {
    expect(
      parseAffiliatePixKeys([
        { type: " CPF ", value: " 12345678901 " },
        { type: "E-mail", value: "   " },
        { type: "Telefone" },
        null,
      ]),
    ).toEqual([CPF]);
  });

  it("tolera jsonb inesperado", () => {
    expect(parseAffiliatePixKeys(null)).toEqual([]);
    expect(parseAffiliatePixKeys({})).toEqual([]);
  });
});
