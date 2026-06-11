\usepackage{xeCJK}
\usepackage{geometry}
\usepackage{setspace}
\usepackage{titlesec}
\usepackage{fancyhdr}
\usepackage{graphicx}
\usepackage{amsmath}
\usepackage{unicode-math}
\usepackage{booktabs}
\usepackage{longtable}
\usepackage{array}
\usepackage{ltcaption}
\usepackage{caption}
\usepackage{float}
\usepackage{needspace}
\usepackage{enumitem}
\usepackage{indentfirst}
\usepackage{fvextra}
\usepackage[most]{tcolorbox}
\usepackage{xcolor}
\usepackage{hyperref}
\usepackage{tikz}
\usetikzlibrary{arrows.meta,positioning,calc}

\geometry{a4paper, top=24mm, bottom=24mm, left=22mm, right=22mm, headsep=8mm, footskip=10mm}
\raggedbottom

\setmainfont{texgyretermes-regular.otf}[
  BoldFont=texgyretermes-bold.otf,
  ItalicFont=texgyretermes-italic.otf,
  BoldItalicFont=texgyretermes-bolditalic.otf
]
\setsansfont{texgyreheros-regular.otf}[
  BoldFont=texgyreheros-bold.otf,
  ItalicFont=texgyreheros-italic.otf,
  BoldItalicFont=texgyreheros-bolditalic.otf
]
\setmonofont{Menlo}[Scale=0.90]
\setmathfont{texgyretermes-math.otf}
\setCJKmainfont{Songti SC}[
  BoldFont=Songti SC Bold,
  ItalicFont=Kaiti SC
]
\setCJKsansfont{Hiragino Sans GB}
\setCJKmonofont{Noto Sans CJK SC}[Scale=0.88]

\setstretch{1.22}
\setlength{\parindent}{2em}
\setlength{\parskip}{0.35em}
\setlength{\tabcolsep}{4pt}
\renewcommand{\arraystretch}{1.15}
\setlength{\LTleft}{0pt}
\setlength{\LTright}{0pt}
\setlength{\LTcapwidth}{\textwidth}
\setlist[itemize]{itemsep=0.28em, topsep=0.35em, parsep=0pt, partopsep=0pt, leftmargin=2.4em}
\setlist[enumerate]{itemsep=0.28em, topsep=0.35em, parsep=0pt, partopsep=0pt, leftmargin=2.4em}

\definecolor{TitleBlue}{HTML}{123A63}
\definecolor{RuleGray}{HTML}{B8C4D6}
\definecolor{DarkSlateBlue}{HTML}{483D8B}
\definecolor{MatlabKeyword}{RGB}{0,0,255}
\definecolor{MatlabComment}{RGB}{34,139,34}
\definecolor{MatlabString}{RGB}{160,32,240}
\definecolor{MatlabNumber}{RGB}{128,0,128}
\definecolor{MatlabCodeBg}{HTML}{F7FAFC}
\definecolor{MatlabCodeFrame}{HTML}{C9D7E8}

\titleformat{\section}
  {\fontsize{16pt}{20pt}\selectfont\sffamily\bfseries\color{TitleBlue}}
  {\thesection}{0.6em}{}
\titleformat{\subsection}
  {\fontsize{14pt}{18pt}\selectfont\sffamily\bfseries\color{TitleBlue}}
  {\thesubsection}{0.6em}{}
\titleformat{\subsubsection}
  {\fontsize{12pt}{16pt}\selectfont\sffamily\bfseries\color{TitleBlue}}
  {\thesubsubsection}{0.6em}{}

\titlespacing*{\section}{0pt}{1.2em}{0.5em}
\titlespacing*{\subsection}{0pt}{1em}{0.35em}
\titlespacing*{\subsubsection}{0pt}{0.8em}{0.25em}

\captionsetup{
  font=small,
  labelfont=bf,
  labelsep=period,
  justification=centering
}
\renewcommand{\thefigure}{__LESSON_ID__-\arabic{figure}}
\renewcommand{\thetable}{__LESSON_ID__-\arabic{table}}
\renewcommand{\theequation}{__LESSON_ID__-\arabic{equation}}
\DeclareCaptionLabelFormat{zhfigure}{图#2}
\DeclareCaptionLabelFormat{zhtable}{表#2}
\captionsetup[figure]{labelformat=zhfigure}
\captionsetup[table]{labelformat=zhtable}
\captionsetup[longtable]{labelformat=zhtable, justification=centering}

\fvset{
  breaklines=true,
  breakanywhere=true,
  fontsize=\normalsize,
  baselinestretch=1.05,
  frame=none,
  commandchars=\\\{\}
}

\renewenvironment{Shaded}
  {\begin{tcolorbox}[
    enhanced,
    breakable,
    colback=MatlabCodeBg,
    colframe=MatlabCodeFrame,
    boxrule=0.35pt,
    arc=0.8mm,
    left=6pt,
    right=6pt,
    top=4pt,
    bottom=4pt,
    before skip=0.65em,
    after skip=0.75em
  ]}
  {\end{tcolorbox}}
\renewcommand{\KeywordTok}[1]{\textcolor{MatlabKeyword}{\textbf{#1}}}
\renewcommand{\ControlFlowTok}[1]{\textcolor{MatlabKeyword}{\textbf{#1}}}
\renewcommand{\BuiltInTok}[1]{\textcolor{MatlabKeyword}{#1}}
\renewcommand{\FunctionTok}[1]{\textcolor{MatlabKeyword}{#1}}
\renewcommand{\CommentTok}[1]{\textcolor{MatlabComment}{#1}}
\renewcommand{\CommentVarTok}[1]{\textcolor{MatlabComment}{#1}}
\renewcommand{\StringTok}[1]{\textcolor{MatlabString}{#1}}
\renewcommand{\VerbatimStringTok}[1]{\textcolor{MatlabString}{#1}}
\renewcommand{\CharTok}[1]{\textcolor{MatlabString}{#1}}
\renewcommand{\DecValTok}[1]{\textcolor{MatlabNumber}{#1}}
\renewcommand{\FloatTok}[1]{\textcolor{MatlabNumber}{#1}}
\makeatletter
\let\@afterindentfalse\@afterindenttrue
\@afterindenttrue
\makeatother

\newtcolorbox{HandoutQuoteBox}{
  enhanced,
  breakable,
  colback=TitleBlue!6!white,
  colframe=TitleBlue!18!white,
  boxrule=0.4pt,
  arc=1.2mm,
  left=8pt,
  right=8pt,
  top=6pt,
  bottom=6pt,
  borderline west={1.8pt}{0pt}{TitleBlue!55!black},
  before skip=0.8em,
  after skip=0.8em
}
\renewenvironment{quote}
  {\begin{HandoutQuoteBox}\sffamily\bfseries\color{TitleBlue}\noindent\ignorespaces}
  {\end{HandoutQuoteBox}}

\pagestyle{fancy}
\fancyhf{}
\fancyhead[L]{\small __HEADER_LEFT__}
\fancyhead[C]{%
  \raisebox{0pt}[0pt][0pt]{%
    \includegraphics[height=8.5mm]{__HEADER_LOGO_LEFT__}%
    \hspace{1.4pt}%
    \includegraphics[height=7.65mm]{__HEADER_LOGO_RIGHT__}%
  }%
}
\fancyhead[R]{\small __HEADER_RIGHT__}
\fancyfoot[C]{\small \thepage}
\setlength{\headheight}{34pt}
\renewcommand{\headrulewidth}{0.35pt}
\renewcommand{\footrulewidth}{0pt}

\hypersetup{
  colorlinks=true,
  linkcolor=TitleBlue,
  urlcolor=DarkSlateBlue,
  citecolor=TitleBlue,
  pdftitle={__PDF_TITLE__}
}
