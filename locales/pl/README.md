<p align="center">
          <a href="https://marketplace.visualstudio.com/items?itemName=learner.vertex"><img src="https://img.shields.io/badge/VS_Code_Marketplace-007ACC?style=flat&logo=visualstudiocode&logoColor=white" alt="VS Code Marketplace"></a>
          <a href="https://x.com/VertexDev"><img src="https://img.shields.io/badge/Vertex-000000?style=flat&logo=x&logoColor=white" alt="X"></a>
          <a href="https://youtube.com/@roocodeyt?feature=shared"><img src="https://img.shields.io/badge/YouTube-FF0000?style=flat&logo=youtube&logoColor=white" alt="YouTube"></a>
          <a href="https://discord.gg/VxfP4Vx3gX"><img src="https://img.shields.io/badge/Join%20Discord-5865F2?style=flat&logo=discord&logoColor=white" alt="Join Discord"></a>
          <a href="https://www.reddit.com/r/Vertex/"><img src="https://img.shields.io/badge/Join%20r%2FVertex-FF4500?style=flat&logo=reddit&logoColor=white" alt="Join r/Vertex"></a>
          <a href="https://github.com/Kirkice/Vertex-Code/issues"><img src="https://img.shields.io/badge/GitHub-Issues-181717?style=flat&logo=github&logoColor=white" alt="GitHub Issues"></a>
        </p>
        <p align="center">
          <em>Szybko uzyskaj pomoc → <a href="https://discord.gg/VxfP4Vx3gX">Dołącz do Discorda</a> • Wolisz asynchronicznie? → <a href="https://www.reddit.com/r/Vertex/">Dołącz do r/Vertex</a></em>
        </p>

        # Vertex

        > Twój zespół deweloperski zasilany AI — prosto w edytorze

        ## Jesteśmy Vertex

> Być może widziałeś [niedawne ogłoszenie](https://x.com/mattrubens/status/2046636598859559114) zespołu Vertex 🦘🦘🦘. W skrócie: zespół stopniowo wygasza aktywny rozwój Vertex Code, skupiając się na [Roomote](https://roomote.dev/). Ta wiadomość była trudna dla wielu użytkowników Vertex; ta wtyczka naprawdę wiele znaczy dla tej społeczności.
>
> Chcemy podziękować całemu zespołowi Vertex za pracę włożoną w tę wtyczkę. Nie będziemy tutaj wymieniać każdej osoby z osobna, ale wszyscy możemy się zgodzić, że to wyjątkowi deweloperzy i, co równie ważne, niesamowici ludzie. Dziękujemy zespołowi Vertex.
>
> Użytkownicy Vertex są bardzo różni. Jedni używają go zawodowo na co dzień, inni wykorzystują go do tworzenia niewiarygodnie złożonych workflow. Niektórzy używają go do ulepszania samego Vertex, a inni do ulepszania modeli, z których Vertex korzysta (super meta). Chodzi o to, że społeczność jest różnorodna, i choć kangur 🦘🦘🦘 jest dostojnym i szlachetnym zwierzęciem, uznaliśmy, że „Vertex” 🐘🦡🦒🦓🦛🦧🦭🦦 lepiej oddaje tę różnorodność użytkowników wtyczki.
>
> Dlatego chcemy ogłosić, że **Vertex** będzie kontynuować rozwój tego ważnego projektu. Główny zespół tworzą deweloperzy, którzy wcześniej współtworzyli Vertex i naprawdę zależy im na tej wtyczce. Będziemy dalej aktualizować modele, naprawiać błędy i wydawać nowe funkcje. Ale przede wszystkim chcemy słuchać was, społeczności, która uczyniła tę wtyczkę tak wyjątkową. Dołącz więc do naszego [Discorda](https://discord.gg/VxfP4Vx3gX), naszego [Reddita](https://www.reddit.com/r/Vertex) albo [otwórz PR lub issue](https://github.com/Kirkice/Vertex-Code); a przede wszystkim prosimy cię, żebyś pozostał zaangażowany, w kontakcie i aktywny jako część społeczności.
>
> _-Vertex Team_

## Migracja z Vertex Code do Vertex

Szybki przewodnik po przejściu z Vertex Code do Vertex znajdziesz w [przewodniku migracji Vertex→Vertex](https://docs.vertex.dev/roo-to-zoo-migration). Chcemy jak najlepiej pomagać użytkownikom w czasie przejścia i właśnie do tego służą nasze [Reddit](https://www.reddit.com/r/Vertex) oraz [Discord](https://discord.gg/VxfP4Vx3gX). Jeśli masz problem albo pytanie, wpadaj i pytaj.

## Nowości w v3.56.0

- Wsparcie dla **Claude Opus 4.8** u dostawców Anthropic, Bedrock i Vertex
- **Opencode Go** dodany jako nowy dostawca API pierwszej klasy
- **Niezawodne anulowanie zadań** — anulowanie zadania teraz poprawnie kończy uruchomiony proces, z automatycznym ponowieniem Ctrl+C dla opornych procesów
- Naprawiono niestandardowe ID modeli Gemini, które były ignorowane i wracały do domyślnego
- Naprawiono obcinanie diffów Grok przez brakujące znaczniki
- Naprawiono wykrywanie PowerShell na Windows bez skonfigurowanego profilu powłoki
- Naprawiono akcje kodu VS Code wyświetlające nazwę Vertex Code; zlokalizowane we wszystkich obsługiwanych językach
- Naprawiono ostrzeżenie Vertex AI przy ścieżce pliku w polu poświadczeń Google Cloud
- Sześć aktualizacji bezpieczeństwa zależności (diff, i18next-http-backend, fast-xml-parser, simple-git, uuid, turbo)

---

## Co Vertex może zrobić dla CIEBIE?

- Generowanie kodu z opisów w języku naturalnym
- Dostosuj się za pomocą trybów: Kod, Architekt, Zapytaj, Debugowanie i Tryby niestandardowe
- Refaktoryzacja i debugowanie istniejącego kodu
- Pisanie i aktualizowanie dokumentacji
- Odpowiadanie na pytania dotyczące Twojej bazy kodu
- Automatyzacja powtarzalnych zadań
- Wykorzystanie serwerów MCP

## Tryby

Vertex dostosowuje się do Twojego sposobu pracy, a nie odwrotnie:

- Tryb Kod: codzienne kodowanie, edycje i operacje na plikach
- Tryb Architekt: planowanie systemów, specyfikacji i migracji
- Tryb Zapytaj: szybkie odpowiedzi, wyjaśnienia i dokumenty
- Tryb Debugowanie: śledzenie problemów, dodawanie logów, izolowanie przyczyn źródłowych
- Tryby niestandardowe: buduj specjalistyczne tryby dla swojego zespołu lub przepływu pracy

Więcej: [Korzystanie z trybów](https://docs.vertex.dev/basic-usage/using-modes) • [Tryby niestandardowe](https://docs.vertex.dev/advanced-usage/custom-modes)

## Filmy instruktażowe i prezentujące funkcje

<div align="center">

|                                                                                                                                                                            |                                                                                                                                                                            |                                                                                                                                                                              |
| :------------------------------------------------------------------------------------------------------------------------------------------------------------------------: | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------: | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------: |
| <a href="https://www.youtube.com/watch?v=Mcq3r1EPZ-4"><img src="https://img.youtube.com/vi/Mcq3r1EPZ-4/maxresdefault.jpg" width="100%"></a><br><b>Instalacja Vertex</b>  | <a href="https://www.youtube.com/watch?v=ZBML8h5cCgo"><img src="https://img.youtube.com/vi/ZBML8h5cCgo/maxresdefault.jpg" width="100%"></a><br><b>Konfiguracja profili</b> | <a href="https://www.youtube.com/watch?v=r1bpod1VWhg"><img src="https://img.youtube.com/vi/r1bpod1VWhg/maxresdefault.jpg" width="100%"></a><br><b>Indeksowanie bazy kodu</b> |
| <a href="https://www.youtube.com/watch?v=iiAv1eKOaxk"><img src="https://img.youtube.com/vi/iiAv1eKOaxk/maxresdefault.jpg" width="100%"></a><br><b>Tryby niestandardowe</b> |   <a href="https://www.youtube.com/watch?v=Ho30nyY332E"><img src="https://img.youtube.com/vi/Ho30nyY332E/maxresdefault.jpg" width="100%"></a><br><b>Punkty kontrolne</b>   | <a href="https://www.youtube.com/watch?v=HmnNSasv7T8"><img src="https://img.youtube.com/vi/HmnNSasv7T8/maxresdefault.jpg" width="100%"></a><br><b>Zarządzanie Kontekstem</b> |

</div>
<p align="center">
<a href="https://docs.vertex.dev/tutorial-videos">Więcej szybkich filmów instruktażowych i prezentujących funkcje...</a>
</p>

## Zasoby

- **[Dokumentacja](https://docs.vertex.dev):** Oficjalny przewodnik po instalacji, konfiguracji i opanowaniu Vertex.
- **[Kanał YouTube](https://youtube.com/@roocodeyt?feature=shared):** Oglądaj samouczki i zobacz funkcje w akcji.
- **[Serwer Discord](https://discord.gg/VxfP4Vx3gX):** Dołącz do społeczności, aby uzyskać pomoc i dyskutować w czasie rzeczywistym.
- **[Społeczność Reddit](https://www.reddit.com/r/Vertex):** Dziel się swoimi doświadczeniami i zobacz, co budują inni.
- **[Problemy na GitHub](https://github.com/Kirkice/Vertex-Code/issues):** Zgłaszaj błędy i śledź rozwój.
- **[Prośby o funkcje](https://github.com/Kirkice/Vertex-Code/discussions/categories/feature-requests?discussions_q=is%3Aopen+category%3A%22Feature+Requests%22+sort%3Atop):** Masz pomysł? Podziel się nim z deweloperami.

---

## Konfiguracja lokalna i programowanie

1. **Sklonuj** repozytorium:

```sh
git clone https://github.com/Kirkice/Vertex-Code.git
```

2. **Zainstaluj zależności**:

```sh
pnpm install
```

3. **Uruchom rozszerzenie**:

Istnieje kilka sposobów na uruchomienie rozszerzenia Vertex:

### Tryb deweloperski (F5)

Do aktywnego programowania użyj wbudowanego debugowania VSCode:

Naciśnij `F5` (lub przejdź do **Uruchom** → **Rozpocznij debugowanie**) w VSCode. Otworzy to nowe okno VSCode z uruchomionym rozszerzeniem Vertex.

- Zmiany w widoku internetowym pojawią się natychmiast.
- Zmiany w rdzeniu rozszerzenia również zostaną automatycznie przeładowane na gorąco.

### Zautomatyzowana instalacja VSIX

Aby zbudować i zainstalować rozszerzenie jako pakiet VSIX bezpośrednio w VSCode:

```sh
pnpm install:vsix [-y] [--editor=<command>]
```

To polecenie:

- Zapyta, którego polecenia edytora użyć (code/cursor/code-insiders) - domyślnie 'code'
- Odinstaluje każdą istniejącą wersję rozszerzenia.
- Zbuduje najnowszy pakiet VSIX.
- Zainstaluje nowo zbudowany VSIX.
- Poprosi o ponowne uruchomienie VS Code w celu wprowadzenia zmian.

Opcje:

- `-y`: Pomiń wszystkie monity o potwierdzenie i użyj wartości domyślnych
- `--editor=<command>`: Określ polecenie edytora (np. `--editor=cursor` lub `--editor=code-insiders`)

### Ręczna instalacja VSIX

Jeśli wolisz zainstalować pakiet VSIX ręcznie:

1.  Najpierw zbuduj pakiet VSIX:
    ```sh
    pnpm vsix
    ```
2.  Plik `.vsix` zostanie wygenerowany w katalogu `bin/` (np. `bin/vertex-<version>.vsix`).
3.  Zainstaluj go ręcznie za pomocą VSCode CLI:
    ```sh
    code --install-extension bin/vertex-<version>.vsix
    ```

---

Używamy [changesets](https://github.com/changesets/changesets) do wersjonowania i publikowania. Sprawdź nasz `CHANGELOG.md`, aby uzyskać informacje o wydaniu.

---

## Zastrzeżenie

**Uwaga** Vertex **nie** składa żadnych oświadczeń ani nie udziela żadnych gwarancji dotyczących jakiegokolwiek kodu, modeli lub innych narzędzi dostarczonych lub udostępnionych w związku z Vertex, jakimikolwiek powiązanymi narzędziami stron trzecich ani żadnymi wynikami. Użytkownik przyjmuje na siebie **wszelkie ryzyko** związane z korzystaniem z takich narzędzi lub wyników; takie narzędzia są dostarczane na zasadzie **"TAK JAK JEST"** i **"W MIARĘ DOSTĘPNOŚCI"**. Takie ryzyko może obejmować, bez ograniczeń, naruszenie własności intelektualnej, luki w zabezpieczeniach cybernetycznych lub ataki, stronniczość, niedokładności, błędy, wady, wirusy, przestoje, utratę lub uszkodzenie mienia i/lub obrażenia ciała. Użytkownik ponosi wyłączną odpowiedzialność za korzystanie z takich narzędzi lub wyników (w tym, bez ograniczeń, za ich legalność, stosowność i wyniki).

---

## Wkład

Uwielbiamy wkłady społeczności! Zacznij od przeczytania naszego pliku [CONTRIBUTING.md](CONTRIBUTING.md).

---

## Licencja

[Apache 2.0 © 2025 Vertex Org](../../LICENSE)

---

**Miłego korzystania z Vertex!** Niezależnie od tego, czy trzymasz go na krótkiej smyczy, czy pozwalasz mu działać autonomicznie, nie możemy się doczekać, żeby zobaczyć, co zbudujesz. Jeśli masz pytania albo pomysły na funkcje, otwórz [issue](https://github.com/Kirkice/Vertex-Code/issues) albo rozpocznij [discussion](https://github.com/Kirkice/Vertex-Code/discussions). Miłego kodowania!
