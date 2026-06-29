# Remuneração do Promotor: Fechamento RH / Financeiro

Bem-vindo ao módulo de auditoria e aprovação da remuneração variável.
Este manual ensinará você, profissional de Gente & Gestão e Financeiro, a configurar salários-base, auditar a folha projetada, aplicar ajustes manuais e travar as aprovações trimestrais.

---

## 1. Cadastro e Variável Base

O primeiro passo para a remuneração funcionar é garantir que o promotor esteja corretamente cadastrado.
Vá em **Gente & Gestão → Cadastro**.

![Tela de Cadastro RH](/images/treinamento/placeholder_cadastro_rh.png)

> [!IMPORTANT]
> **Cargo vs Perfil de Acesso**
> É crucial entender a diferença:
> * **Cargo (ex: Promotor, Promotor Líder):** É o título oficial do funcionário no RH (como aparece no contracheque).
> * **Perfil de Acesso (ex: Promotor, Supervisor, Admin):** É a permissão que ele tem *dentro do sistema*. Apenas usuários com Perfil "Promotor" aparecerão nas telas de Desafio e Metas.

Ao cadastrar, você informará a **Variável Mensal Base** (ex: R$ 1.000,00). 
Este é o valor de referência 100% mensal que o motor de cálculo usará.

---

## 2. Definindo Metas e Redes (Trade Marketing)

No módulo de **Metas Promotor**, o Trade vincula o promotor às redes que ele atende e preenche o valor da meta em reais.

> [!CAUTION]
> **Rota vs Meta**
> Rota (onde ele bate ponto) é diferente de Meta (onde ele gera volume de vendas). Um promotor pode visitar 15 lojas, mas ter meta de venda apenas em 3 redes principais. Ambas as telas permitem configurações separadas.

![Tela Metas Promotor](/images/treinamento/placeholder_metas.png)

---

## 3. O Painel de Remuneração (O Fechamento)

No fim do mês, você acessa **Gente & Gestão → Remuneração Promotor**.

Nesta tela, o sistema cruza a *Variável Base*, a *Meta (Trade)* e o *Realizado (Sankhya)* para cuspir automaticamente a folha de pagamento variável.

![Tela Remuneração Promotor RH](/images/treinamento/placeholder_remuneracao_rh.png)

Você verá badges de auditoria visuais muito práticos na coluna **Valor Final (RH)**:
* 🟢 **Calculado Auto:** Significa que o valor é 100% puro do sistema (não teve alteração manual).
* 🔵 **Com Recuperação Tri:** Significa que o sistema identificou que era fim de trimestre e injetou automaticamente a Recuperação (Catch-up).
* 🟡 **Ajustado Manualmente:** Significa que alguém do RH sobrescreveu o valor.

### Ajuste Manual (Override)
Se houver alguma bonificação excepcional, você pode apagar o valor da coluna "Valor Final (RH)" e digitar o valor novo. 
**Regra do Sistema:** Ao fazer isso, você é **obrigado** a preencher uma Justificativa de Auditoria (ex: "Ação especial de vendas Pão de Açúcar").

---

## 4. O Fluxo de Aprovação e Travamento

Para evitar erros contábeis, o módulo de remuneração possui um Workflow blindado.

![Fluxograma de Aprovação Financeira](/images/treinamento/fluxograma_aprovacao.png)

1. **DRAFT (Rascunho):** Durante o mês, os valores oscilam conforme as vendas.
2. **FECHADO:** O sistema congela o faturamento no último dia do mês.
3. **APROVADO RH:** Você revisa os números e clica em "Salvar Rascunho".
4. **ENVIADO FOLHA:** Você exporta os dados.
5. **PAGO:** Concluído.

> [!WARNING]
> **Botão "Aprovar Fechamento" (Lock Trimestral)**
> No fim do trimestre, após aprovar e pagar os valores (incluindo as recuperações), clique no botão amarelo **Aprovar Fechamento**. Isso **TRAVA** o trimestre inteiro. Ninguém (nem mesmo o Admin) poderá alterar a Variável, o Valor ou as Metas daquele período. Isso garante a integridade da auditoria!
