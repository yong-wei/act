import React, { useState, useEffect, useRef } from 'react';

// -------------------------------------------
// 辅助数据和组件
// -------------------------------------------

const ICONS = {
  ChevronUp: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m18 15-6-6-6 6" />
    </svg>
  ),
  Bot: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 8V4H8" />
      <rect width="16" height="12" x="4" y="8" rx="2" />
      <path d="M2 14h2" />
      <path d="M20 14h2" />
      <path d="M15 13v2" />
      <path d="M9 13v2" />
    </svg>
  ),
  User: () => (
     <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/>
        <circle cx="12" cy="7" r="4"/>
    </svg>
  ),
  Send: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m22 2-7 20-4-9-9-4Z"/>
        <path d="M22 2 11 13"/>
    </svg>
  )
};

const navLinks = [
  { name: '首页', href: '#home' },
  { name: '核心架构', href: '#architecture' },
  { name: '技术内核', href: '#tech' },
  { name: '成果展示', href: '#achievements' },
  { name: '系统体验', href: '#demo' },
  { name: '联系我们', href: '#contact' },
];

const agents = [
  { name: '思政型智能体', description: '融合船舶工业案例库与英模精神，通过人机对话引导学生树立“兴船报国”价值观，强化工匠精神。' },
  { name: '课程型智能体', description: '构建船舶领域知识库和AI问答平台，提供个性化学习路径规划与智能答疑，解决课程学习难题。' },
  { name: '竞赛型智能体', description: '整合海量竞赛数据，为学生智能生成赛事画像与备赛策略，显著提升竞赛效率和获奖率。' },
  { name: '探究型智能体', description: '通过AI引导式互动和多轮对话，辅助学生高效进行科研训练、文献梳理与创新探索。' },
  { name: '任务型智能体', description: '动态追踪学生各环节进度，进行智能诊断与双轨反馈，自动生成可追溯的学习档案。' },
  { name: '评价型智能体', description: '基于多维数据进行综合评价与智能分析，优化反馈系统，并提供心理健康预警与支持。' },
];

const achievementsData = [
    { value: 95, unit: '%', text: '思政Agent用户满意度' },
    { value: 25, unit: '%', text: '学科竞赛获奖率增长' },
    { value: 500, unit: '+', text: '覆盖本科生数量' },
    { value: 7, unit: '类', text: '核心协同智能体' },
];

const certificates = [
    { src: 'https://storage.googleapis.com/maker-media-experiment/media/images/23-06-2025_14-11-21_120152.png', alt: '应用成果-证书集合' },
    // Mock additional certificates for gallery effect
    { src: 'https://placehold.co/800x600/003366/ffffff?text=国家级大创项目证书', alt: '国家级大创项目证书' },
    { src: 'https://placehold.co/800x600/005a9c/ffffff?text=省级一流课程证书', alt: '省级一流课程证书' },
    { src: 'https://placehold.co/800x600/1c2938/ffffff?text=软件著作权证书', alt: '软件著作权证书' },
];

const chatSimulation = [
  {
    type: 'question',
    text: '我是一名自动化系的学生，我想参加一些学科竞赛，有什么比赛推荐吗？',
  },
  {
    type: 'answer',
    text: '作为自动化专业的学生，你有许多优质的竞赛可以选择，这些比赛不仅能提升你的专业技能，还能为保研、就业加分。以下是结合你的专业背景和当前竞赛时间线的一些推荐：\n1. 西门子杯中国智能制造挑战赛 (CIMC)：国家级A类赛事，涉及智能制造领域的工程设计与应用，创新研发方向。通常在5月报名，7月总决赛。\n2. 全国大学生智能汽车竞赛：教育部主办，涉及自动控制、模式识别、传感技术等，是自动化专业的核心技能展现平台。\n3. 全国大学生电子设计竞赛：综合性强，考验电路设计、软件编程和团队协作能力。',
    delay: 1500,
  },
   {
    type: 'question',
    text: '非线性和定值控制系统有什么特点？',
  },
  {
    type: 'answer',
    text: '很好的问题！\n非线性系统的输入和输出之间不存线性关系，其稳定性不仅与系统自身结构和参数有关，而且与系统的初始状态密切相关，可能会产生自激振荡等复杂现象。\n定值控制系统主要用于保持系统输出在一个恒定值，适用于对动态精度要求较高的场合。它通常通过设置误差调节的静态过程来实现控制。',
    delay: 2000,
  },
];


// -------------------------------------------
// 自定义Hooks
// -------------------------------------------

const useScrollAnimation = () => {
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.unobserve(entry.target);
        }
      },
      {
        threshold: 0.1,
      }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => {
      if (ref.current) {
        observer.unobserve(ref.current);
      }
    };
  }, []);

  return [ref, isVisible];
};

const useAnimatedCounter = (targetValue, isVisible, duration = 2000) => {
    const [count, setCount] = useState(0);

    useEffect(() => {
        if (!isVisible) return;

        let startTime = null;
        const animate = (timestamp) => {
            if (!startTime) startTime = timestamp;
            const progress = Math.min((timestamp - startTime) / duration, 1);
            const currentCount = Math.floor(progress * targetValue);
            setCount(currentCount);

            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                setCount(targetValue);
            }
        };

        requestAnimationFrame(animate);

    }, [isVisible, targetValue, duration]);
    return count;
}


// -------------------------------------------
// 主要UI组件
// -------------------------------------------

const Header = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${isScrolled ? 'bg-white/80 backdrop-blur-lg shadow-md' : 'bg-transparent'}`}>
      <div className="container mx-auto px-6 py-3 flex justify-between items-center">
        <a href="#home" className={`text-xl font-bold ${isScrolled ? 'text-gray-800' : 'text-white'}`}>
          <ICONS.Bot/> “船说” ShipTalk
        </a>
        <div className="hidden md:flex space-x-6 items-center">
          {navLinks.map((link) => (
            <a key={link.name} href={link.href} className={`font-medium transition-colors duration-300 ${isScrolled ? 'text-gray-600 hover:text-blue-600' : 'text-gray-200 hover:text-white'}`}>
              {link.name}
            </a>
          ))}
        </div>
        <div className="md:hidden">
            <button onClick={() => setIsOpen(!isOpen)} className={`focus:outline-none ${isScrolled ? 'text-gray-800' : 'text-white'}`}>
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={isOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16m-7 6h7"}></path>
                </svg>
            </button>
        </div>
      </div>
      {isOpen && (
        <div className="md:hidden bg-white/90 backdrop-blur-lg">
          {navLinks.map((link) => (
            <a key={link.name} href={link.href} onClick={() => setIsOpen(false)} className="block py-2 px-6 text-sm text-gray-700 hover:bg-gray-200">{link.name}</a>
          ))}
        </div>
      )}
    </nav>
  );
};

const HeroSection = () => (
  <section id="home" className="h-screen bg-cover bg-center flex items-center justify-center text-white" style={{ backgroundImage: "url('https://storage.googleapis.com/maker-media-experiment/media/images/23-06-2025_14-11-20_261555.png')" }}>
    <div className="absolute inset-0 bg-black/50"></div>
    <div className="relative text-center z-10 p-4 animate-fade-in-up">
      <h1 className="text-4xl md:text-6xl font-extrabold mb-4 drop-shadow-lg">“船说” (ShipTalk)</h1>
      <p className="text-lg md:text-2xl mb-8 max-w-3xl mx-auto drop-shadow-md">
        基于国产微调优化LLM的船舶特色全链教育Agent集群系统
      </p>
      <p className="text-xl md:text-2xl font-bold drop-shadow-md">江苏科技大学</p>
    </div>
  </section>
);


const ArchitectureSection = () => {
    const [ref, isVisible] = useScrollAnimation();
    const [activeIndex, setActiveIndex] = useState(null);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const radius = isMobile ? 120 : 250; 
    const numItems = agents.length;
    
    return (
        <section id="architecture" className="py-20 bg-gray-50">
            <div className="container mx-auto px-6 text-center">
                <h2 className="text-3xl font-bold mb-4 text-gray-800">核心架构：七位一体的智能协同</h2>
                <p className="max-w-3xl mx-auto text-gray-600 mb-16">
                    “船说”系统的核心是一个由七种不同功能的智能体组成的矩阵网络。它们在“协同型智能体”的统一调度下，各司其职、高效联动，为学生的成长提供全方位、个性化的支持。
                </p>
                <div ref={ref} className={`relative w-full flex justify-center items-center transition-opacity duration-1000 ${isVisible ? 'opacity-100' : 'opacity-0'}`} style={{ height: `${isMobile ? 320 : 600}px` }}>
                    <div className="absolute flex justify-center items-center w-32 h-32 md:w-48 md:h-48 bg-blue-600 text-white rounded-full shadow-lg z-10 flex-col p-4">
                       <h3 className="md:text-xl font-bold">协同型智能体</h3>
                       <p className="text-xs md:text-sm mt-1">集群“大脑”，负责统一调度与资源分配</p>
                    </div>
                    {agents.map((agent, index) => {
                        const angle = (index / numItems) * 2 * Math.PI - Math.PI / 2;
                        const x = radius * Math.cos(angle);
                        const y = radius * Math.sin(angle);
                        
                        return(
                            <div key={agent.name}
                                className="absolute transition-all duration-500"
                                style={{ transform: `translate(${x}px, ${y}px)` }}
                                onMouseEnter={() => !isMobile && setActiveIndex(index)}
                                onMouseLeave={() => !isMobile && setActiveIndex(null)}
                                onClick={() => setActiveIndex(activeIndex === index ? null : index)}
                            >
                                <div className={`relative flex justify-center items-center w-28 h-28 md:w-36 md:h-36 bg-white rounded-full shadow-md cursor-pointer border-2 transition-all duration-300 ${activeIndex === index ? 'border-blue-500 scale-110' : 'border-transparent'}`}>
                                    <p className="text-sm md:text-base font-semibold text-center text-gray-700 p-2">{agent.name}</p>
                                </div>
                            </div>
                        )
                    })}
                     {activeIndex !== null && (
                        <div className="absolute z-20 w-64 p-4 bg-white rounded-lg shadow-xl text-left transition-opacity duration-300 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 md:top-auto md:bottom-0 md:left-1/2 md:-translate-x-1/2 md:translate-y-full">
                            <h4 className="font-bold text-blue-700 mb-2">{agents[activeIndex].name}</h4>
                            <p className="text-sm text-gray-600">{agents[activeIndex].description}</p>
                        </div>
                     )}
                </div>
            </div>
        </section>
    );
};


const TechStackSection = () => {
  const [ref, isVisible] = useScrollAnimation();
  const techs = ["通义千问Qwen2.5-32b", "bge-large-zh-v1.5", "Neo4j 知识图谱", "Microsoft AutoGen", "RAG 检索增强"];
  return (
    <section id="tech" className="py-20 bg-white">
      <div className="container mx-auto px-6 text-center">
        <h2 className="text-3xl font-bold mb-4 text-gray-800">技术内核</h2>
        <p className="max-w-3xl mx-auto text-gray-600 mb-12">
          项目依托前沿的人工智能技术，构建了坚实的技术底座，确保系统的智能化、高效化与前瞻性。
        </p>
        <div ref={ref} className="flex flex-wrap justify-center items-center gap-4 md:gap-8">
          {techs.map((tech, index) => (
            <div key={tech} className={`transition-all duration-500 ease-out ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`} style={{ transitionDelay: `${index * 100}ms`}}>
              <div className="bg-gray-100 text-gray-700 font-medium py-3 px-6 rounded-full shadow-sm hover:bg-blue-100 hover:text-blue-700 transition-colors cursor-default">
                {tech}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

const AchievementsSection = () => {
    const [ref, isVisible] = useScrollAnimation();
    const [modalOpen, setModalOpen] = useState(false);
    const [currentImg, setCurrentImg] = useState(0);

    const openModal = (index) => {
        setCurrentImg(index);
        setModalOpen(true);
    };

    const closeModal = () => setModalOpen(false);
    const nextImg = () => setCurrentImg((prev) => (prev + 1) % certificates.length);
    const prevImg = () => setCurrentImg((prev) => (prev - 1 + certificates.length) % certificates.length);

    return (
        <section id="achievements" ref={ref} className="py-20 bg-gray-50">
            <div className="container mx-auto px-6">
                <h2 className="text-3xl font-bold text-center mb-4 text-gray-800">丰硕成果</h2>
                <p className="max-w-3xl mx-auto text-gray-600 mb-12 text-center">
                    自系统试点应用以来，已在学生培养、课程建设、教学研究等多个方面取得了显著成效。
                </p>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center mb-16">
                    {achievementsData.map((item, index) => (
                        <div key={index} className={`transition-opacity duration-1000 ${isVisible ? 'opacity-100' : 'opacity-0'}`} style={{transitionDelay: `${index * 150}ms`}}>
                            <p className="text-4xl md:text-6xl font-bold text-blue-600">
                                <span className="tabular-nums">{useAnimatedCounter(item.value, isVisible)}</span>{item.unit}
                            </p>
                            <p className="text-gray-600 mt-2">{item.text}</p>
                        </div>
                    ))}
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {certificates.map((cert, index) => (
                        <div key={index} onClick={() => openModal(index)} className={`cursor-pointer overflow-hidden rounded-lg shadow-md hover:shadow-xl transition-shadow duration-300 group ${index > 1 ? 'hidden md:block' : ''}`}>
                            <img src={cert.src} alt={cert.alt} className="w-full h-full object-cover transform group-hover:scale-110 transition-transform duration-300" />
                        </div>
                    ))}
                </div>
            </div>

            {modalOpen && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50" onClick={closeModal}>
                    <div className="relative" onClick={(e) => e.stopPropagation()}>
                        <button onClick={closeModal} className="absolute -top-10 right-0 text-white text-3xl font-bold">&times;</button>
                        <img src={certificates[currentImg].src} alt={certificates[currentImg].alt} className="max-w-[90vw] max-h-[80vh] rounded-lg" />
                        <button onClick={prevImg} className="absolute top-1/2 left-4 -translate-y-1/2 bg-white/50 p-2 rounded-full text-gray-800 hover:bg-white">&lt;</button>
                        <button onClick={nextImg} className="absolute top-1/2 right-4 -translate-y-1/2 bg-white/50 p-2 rounded-full text-gray-800 hover:bg-white">&gt;</button>
                    </div>
                </div>
            )}
        </section>
    );
};

const ChatDemo = () => {
    const [messages, setMessages] = useState([]);
    const [questionsQueue, setQuestionsQueue] = useState([...chatSimulation]);
    const [isTyping, setIsTyping] = useState(false);
    const [canAsk, setCanAsk] = useState(true);
    const endOfMessagesRef = useRef(null);
    const [ref, isVisible] = useScrollAnimation();

    const scrollToBottom = () => {
        endOfMessagesRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(scrollToBottom, [messages]);
    
    useEffect(() => {
        if(isVisible && messages.length === 0){
             setMessages([{ type: 'answer', text: '欢迎来到“船说”系统体验中心！您可以点击下方预设问题，与课程型智能体进行互动。' }]);
        }
    }, [isVisible]);

    const handleAskQuestion = () => {
        if (!canAsk || isTyping || questionsQueue.length === 0) return;

        const nextInteraction = [];
        let question, answer;
        
        if (questionsQueue[0].type === 'question') {
            question = questionsQueue.shift();
            answer = questionsQueue.shift();
        } else {
             // Should not happen if data is well-formed
             return;
        }

        setMessages(prev => [...prev, question]);
        setCanAsk(false);
        setIsTyping(true);
        
        setTimeout(() => {
            setIsTyping(false);
            setMessages(prev => [...prev, answer]);
            setCanAsk(true);
        }, answer.delay || 1000);

        // Reset if all questions are asked
        if (questionsQueue.length === 0) {
            setTimeout(() => setQuestionsQueue([...chatSimulation]), 3000);
        }
    };

    return (
        <section id="demo" ref={ref} className="py-20 bg-white">
            <div className="container mx-auto px-6">
                <h2 className="text-3xl font-bold text-center mb-4 text-gray-800">系统体验</h2>
                <p className="max-w-3xl mx-auto text-gray-600 mb-12 text-center">
                    与我们的“课程型智能体”进行一次模拟对话，感受AI如何辅助学习。
                </p>

                <div className={`mx-auto max-w-2xl border border-gray-200 rounded-lg shadow-2xl flex flex-col transition-opacity duration-1000 ${isVisible ? 'opacity-100' : 'opacity-0'}`} style={{height: '600px'}}>
                    {/* Chat Header */}
                    <div className="p-4 border-b border-gray-200 bg-gray-50 rounded-t-lg">
                        <h3 className="font-semibold text-gray-800">课程型智能体</h3>
                        <div className="flex items-center text-sm text-green-500">
                           <span className="h-2 w-2 bg-green-500 rounded-full mr-2"></span>
                           在线
                        </div>
                    </div>
                    
                    {/* Chat Body */}
                    <div className="flex-1 p-6 overflow-y-auto bg-gray-100/30">
                        <div className="space-y-4">
                        {messages.map((msg, index) => (
                            <div key={index} className={`flex items-end gap-2 ${msg.type === 'question' ? 'justify-end' : 'justify-start'}`}>
                               {msg.type === 'answer' && <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white flex-shrink-0"><ICONS.Bot /></div>}
                                <div className={`max-w-md p-3 rounded-lg ${msg.type === 'question' ? 'bg-blue-500 text-white rounded-br-none' : 'bg-white text-gray-700 shadow-sm rounded-bl-none border border-gray-200'}`}>
                                    <p className="text-sm" style={{ whiteSpace: 'pre-wrap' }}>{msg.text}</p>
                                </div>
                                {msg.type === 'question' && <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center text-gray-600 flex-shrink-0"><ICONS.User /></div>}
                            </div>
                        ))}
                         {isTyping && (
                             <div className="flex items-end gap-2 justify-start">
                                 <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white flex-shrink-0"><ICONS.Bot /></div>
                                 <div className="p-3 rounded-lg bg-white text-gray-700 shadow-sm rounded-bl-none border border-gray-200">
                                    <div className="flex items-center gap-1">
                                        <span className="w-2 h-2 bg-gray-400 rounded-full animate-pulse"></span>
                                        <span className="w-2 h-2 bg-gray-400 rounded-full animate-pulse" style={{animationDelay: '0.2s'}}></span>
                                        <span className="w-2 h-2 bg-gray-400 rounded-full animate-pulse" style={{animationDelay: '0.4s'}}></span>
                                    </div>
                                 </div>
                             </div>
                         )}
                        <div ref={endOfMessagesRef} />
                        </div>
                    </div>

                    {/* Chat Input */}
                    <div className="p-4 border-t border-gray-200 bg-gray-50 rounded-b-lg">
                        <button 
                            onClick={handleAskQuestion}
                            disabled={!canAsk || isTyping || questionsQueue.length === 0} 
                            className="w-full bg-blue-600 text-white font-semibold py-3 px-4 rounded-lg flex items-center justify-center gap-2 transition-all duration-300 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed">
                                {isTyping ? '智能体正在输入...' : '点击提问下一个问题'}
                                <ICONS.Send />
                        </button>
                    </div>
                </div>
            </div>
        </section>
    );
};

const Footer = () => (
    <footer id="contact" className="bg-gray-800 text-white">
        <div className="container mx-auto px-6 py-12">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div>
                    <h3 className="text-lg font-bold mb-4">“船说” | 江苏科技大学</h3>
                    <p className="text-gray-400 text-sm">
                        致力于通过AI技术革新船舶特色工科教育，培养面向未来的海洋强国人才。
                    </p>
                </div>
                <div>
                    <h3 className="text-lg font-bold mb-4">联系方式</h3>
                    <ul className="text-gray-400 text-sm space-y-2">
                        <li><strong>联系人:</strong> 张永韡, 朱志宇</li>
                        <li><strong>邮箱:</strong> <a href="mailto:ywzhang@just.edu.cn" className="hover:text-blue-400 transition-colors">ywzhang@just.edu.cn</a></li>
                        <li><strong>电话:</strong> 13952881575</li>
                    </ul>
                </div>
                <div>
                    <h3 className="text-lg font-bold mb-4">相关链接</h3>
                     <ul className="text-gray-400 text-sm space-y-2">
                        <li><a href="https://www.just.edu.cn/" target="_blank" rel="noopener noreferrer" className="hover:text-blue-400 transition-colors">江苏科技大学官网</a></li>
                        <li><a href="https://zidonghua.just.edu.cn/" target="_blank" rel="noopener noreferrer" className="hover:text-blue-400 transition-colors">自动化学院官网</a></li>
                        <li><a href="http://autochat.just.edu.cn" target="_blank" rel="noopener noreferrer" className="hover:text-blue-400 transition-colors">“船说”系统登录</a></li>
                    </ul>
                </div>
            </div>
            <div className="mt-12 border-t border-gray-700 pt-6 text-center text-gray-500 text-sm">
                <p>&copy; 2025 江苏科技大学. All Rights Reserved.</p>
            </div>
        </div>
    </footer>
);

const ScrollToTopButton = () => {
    const [isVisible, setIsVisible] = useState(false);

    const toggleVisibility = () => {
        if (window.pageYOffset > 300) {
            setIsVisible(true);
        } else {
            setIsVisible(false);
        }
    };

    const scrollToTop = () => {
        window.scrollTo({
            top: 0,
            behavior: 'smooth',
        });
    };

    useEffect(() => {
        window.addEventListener('scroll', toggleVisibility);
        return () => window.removeEventListener('scroll', toggleVisibility);
    }, []);

    return (
        <button
            onClick={scrollToTop}
            className={`fixed bottom-8 right-8 bg-blue-600 text-white p-3 rounded-full shadow-lg hover:bg-blue-70s0 transition-opacity duration-300 ${isVisible ? 'opacity-100' : 'opacity-0'}`}
        >
            <ICONS.ChevronUp />
        </button>
    );
};


// -------------------------------------------
// 主应用组件
// -------------------------------------------
export default function App() {
  useEffect(() => {
    // 设置平滑滚动
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const targetId = this.getAttribute('href');
            const targetElement = document.querySelector(targetId);
            if (targetElement) {
                targetElement.scrollIntoView({
                    behavior: 'smooth'
                });
            }
        });
    });
  }, []);

  return (
    <div className="bg-white text-gray-800">
      <style>{`
        @keyframes fade-in-up {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in-up {
            animation: fade-in-up 1s ease-out forwards;
        }
      `}</style>
      <Header />
      <main>
        <HeroSection />
        <ArchitectureSection />
        <TechStackSection />
        <AchievementsSection />
        <ChatDemo />
      </main>
      <Footer />
      <ScrollToTopButton />
    </div>
  );
}